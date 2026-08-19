import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/documentStatus";

// 스텁 처리 — 실제 AI OCR 파이프라인(Gemini, 서버 전용)은 Phase 4에서 붙인다.
// 지금은 검수함 구조(원본/정규화/최종값 분리)를 미리 채워 넣기 위해 필드값 껍데기만
// 만들고, 전부 "검수 필요" 상태로 둔다. PRD_폼솔루션 §7.7.16 review_reasons 목록 중
// manual_review_requested를 사용한다.
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
  await prisma.fieldValue.createMany({
    data: [
      ...fields.map((f) => ({
        documentId,
        fieldId: f.id,
        reviewStatus: "needs_review" as const,
        reviewReasons: ["manual_review_requested"],
      })),
      // 반복행 실제 작성 행 수는 필기 인식 없이 알 수 없다 — 스텁은 1행만 만들어 둔다.
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
