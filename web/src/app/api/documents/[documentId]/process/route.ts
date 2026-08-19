import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { canTransition } from "@/lib/documentStatus";
import { parseDataUri } from "@/lib/dataUri";
import { handwritingOcrProvider } from "@/lib/ai/handwritingOcr";
import { normalizeValue } from "@/lib/normalizeValue";

// PRD_폼솔루션 §7.7.16: OCR 원본값이 있어도 자동으로 확정하지 않는다 — 전부 검수 필요로 둔다.
// review_reasons 목록의 manual_review_requested는 OCR을 아예 못 돌린 스텁 케이스에서만 쓴다.
export async function POST(_req: Request, ctx: RouteContext<"/api/documents/[documentId]/process">) {
  const { documentId } = await ctx.params;
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!canTransition(document.status, "processing")) {
    return Response.json({ error: "INVALID_TRANSITION", from: document.status, to: "processing" }, { status: 409 });
  }

  await prisma.document.update({ where: { id: documentId }, data: { status: "processing" } });

  const [fields, repeatGroups] = await Promise.all([
    prisma.field.findMany({ where: { templateVersionId: document.templateVersionId } }),
    prisma.repeatGroup.findMany({
      where: { templateVersionId: document.templateVersionId },
      include: { columns: true },
    }),
  ]);

  await prisma.fieldValue.deleteMany({ where: { documentId } });

  const pageImages = (document.pageImages as unknown as string[]) ?? [];
  const image = pageImages.length > 0 ? parseDataUri(pageImages[0]) : null;
  const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY);

  // GEMINI_API_KEY가 없거나 실제 이미지가 없으면(스텁 문자열 등) AI를 호출하지 않고
  // 전부 "검수 필요, 원본값 없음" 상태로만 만든다 (PRD §7.7.9: API 키 없음은 로컬 Mock만 허용).
  if (!apiKeyConfigured || !image) {
    await prisma.fieldValue.createMany({
      data: [
        ...fields.map((f) => ({
          documentId,
          fieldId: f.id,
          reviewStatus: "needs_review" as const,
          reviewReasons: ["manual_review_requested"],
        })),
        ...repeatGroups.flatMap((g) =>
          g.columns.map((c) => ({
            documentId,
            repeatGroupId: g.id,
            repeatColumnId: c.id,
            rowIndex: 0,
            reviewStatus: "needs_review" as const,
            reviewReasons: ["manual_review_requested"],
          }))
        ),
      ],
    });
    const updated = await prisma.document.update({ where: { id: documentId }, data: { status: "review_required" } });
    return Response.json(updated);
  }

  const promptVersion = process.env.AI_PROMPT_VERSION ?? "form-v1";
  const job = await prisma.aiJob.create({
    data: {
      targetType: "document",
      targetId: documentId,
      documentId,
      jobType: "handwriting_ocr",
      status: "processing",
      provider: "gemini",
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      promptVersion,
      requestPayload: fields.map((f) => ({ dataKey: f.dataKey, label: f.label, type: f.type })) as Prisma.InputJsonValue,
    },
  });

  let results;
  try {
    results = await handwritingOcrProvider.recognize({
      imageBase64: image.data,
      mimeType: image.mimeType,
      fields: fields.map((f) => ({ dataKey: f.dataKey, label: f.label, type: f.type })),
    });
  } catch (e) {
    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: e instanceof Error ? e.message : String(e) },
    });
    await prisma.document.update({ where: { id: documentId }, data: { status: "error" } });
    return Response.json({ error: "AI_OCR_FAILED", message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  const byDataKey = new Map(results.map((r) => [r.dataKey, r]));

  await prisma.fieldValue.createMany({
    data: [
      ...fields.map((f) => {
        const r = byDataKey.get(f.dataKey);
        return {
          documentId,
          fieldId: f.id,
          rawOcrValue: r?.rawValue ?? null,
          normalizedValue: r ? normalizeValue(f.type, r.rawValue) : null,
          valueSource: r ? ("ai" as const) : null,
          confidence: r?.confidence ?? null,
          model: job.model,
          promptVersion,
          reviewStatus: "needs_review" as const,
          reviewReasons: r?.rawValue ? [] : ["required_missing"],
        };
      }),
      // 반복행 실제 작성 행 수는 이번 단계에서 아직 감지하지 않는다 (행 단위 OCR은 후속 범위).
      ...repeatGroups.flatMap((g) =>
        g.columns.map((c) => ({
          documentId,
          repeatGroupId: g.id,
          repeatColumnId: c.id,
          rowIndex: 0,
          reviewStatus: "needs_review" as const,
          reviewReasons: ["manual_review_requested"],
        }))
      ),
    ],
  });

  await prisma.aiJob.update({
    where: { id: job.id },
    data: { status: "completed", responsePayload: results as unknown as Prisma.InputJsonValue },
  });

  const updated = await prisma.document.update({ where: { id: documentId }, data: { status: "review_required" } });
  return Response.json(updated);
}
