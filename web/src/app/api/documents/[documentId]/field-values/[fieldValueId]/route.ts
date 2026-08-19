import { prisma } from "@/lib/prisma";
import { updateFieldValueSchema } from "@/lib/schemas";

// Phase 5에서 필드 유형별 검증 규칙(정규화·형식 오류 등)을 이 자리에 추가한다.
// 지금은 검수자가 최종값을 입력하면 "확인 필요"에서 "확인됨"으로만 바꾼다.
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/documents/[documentId]/field-values/[fieldValueId]">
) {
  const { fieldValueId } = await ctx.params;
  const body = await req.json();
  const parsed = updateFieldValueSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const current = await prisma.fieldValue.findUnique({ where: { id: fieldValueId } });
  if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const updated = await prisma.fieldValue.update({
    where: { id: fieldValueId },
    data: {
      finalValue: parsed.data.finalValue,
      valueSource: "user",
      reviewStatus: "confirmed",
      reviewReasons: [],
    },
  });
  return Response.json(updated);
}
