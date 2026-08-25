import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { parseDataUri } from "@/lib/dataUri";
import { handwritingOcrProvider } from "@/lib/ai/handwritingOcr";
import { validateFieldValue } from "@/lib/fieldValueValidation";
import type { FieldConfig } from "@/types";

// process/route.ts와 demo-reprocess/route.ts가 공유하는 실제 OCR 실행 로직. 상태 전이
// 검증(canTransition)은 호출부 책임이다 — 정식 흐름(process)은 반드시 확인하고, 데모
// 전용 재실행(demo-reprocess)은 의도적으로 건너뛴다.
export async function runOcrPipeline(documentId: string): Promise<
  { ok: true; status: string } | { ok: false; status: 502; error: string; message: string }
> {
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  await prisma.document.update({ where: { id: documentId }, data: { status: "processing" } });

  const [fields, repeatGroups] = await Promise.all([
    prisma.field.findMany({
      where: { templateVersionId: document.templateVersionId },
      include: { choiceOptions: { orderBy: { orderNo: "asc" } } },
    }),
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
    await prisma.document.update({ where: { id: documentId }, data: { status: "review_required" } });
    return { ok: true, status: "review_required" };
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
      fields: fields.map((f) => ({
        dataKey: f.dataKey,
        label: f.label,
        type: f.type,
        box: { x: f.boxX, y: f.boxY, w: f.boxW, h: f.boxH },
        config: f.config as FieldConfig,
        choiceOptions: f.choiceOptions.map((o) => ({ label: o.label, storedValue: o.storedValue })),
      })),
    });
  } catch (e) {
    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: e instanceof Error ? e.message : String(e) },
    });
    await prisma.document.update({ where: { id: documentId }, data: { status: "error" } });
    return { ok: false, status: 502, error: "AI_OCR_FAILED", message: e instanceof Error ? e.message : String(e) };
  }

  const byDataKey = new Map(results.map((r) => [r.dataKey, r]));

  await prisma.fieldValue.createMany({
    data: [
      ...fields.map((f) => {
        const r = byDataKey.get(f.dataKey);
        const { normalizedValue, reviewReasons } = validateFieldValue({
          type: f.type,
          required: f.required,
          config: f.config as FieldConfig,
          choiceOptions: f.choiceOptions.map((o) => o.storedValue),
          finalValue: r?.rawValue ?? null,
        });
        return {
          documentId,
          fieldId: f.id,
          rawOcrValue: r?.rawValue ?? null,
          normalizedValue,
          finalValue: normalizedValue,
          valueSource: r ? ("ai" as const) : null,
          confidence: r?.confidence ?? null,
          model: job.model,
          promptVersion,
          reviewStatus: reviewReasons.length === 0 ? ("confirmed" as const) : ("needs_review" as const),
          reviewReasons,
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

  await prisma.document.update({ where: { id: documentId }, data: { status: "review_required" } });
  return { ok: true, status: "review_required" };
}
