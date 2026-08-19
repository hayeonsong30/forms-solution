import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { updateFieldValueSchema } from "@/lib/schemas";
import { validateFieldValue, type ReviewReason } from "@/lib/fieldValueValidation";
import type { CheckConfig, FieldConfig } from "@/types";

export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/documents/[documentId]/field-values/[fieldValueId]">
) {
  const { documentId, fieldValueId } = await ctx.params;
  const body = await req.json();
  const parsed = updateFieldValueSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const current = await prisma.fieldValue.findUnique({
    where: { id: fieldValueId },
    include: { field: true, repeatColumn: true },
  });
  if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const source = current.field ?? current.repeatColumn;
  if (!source) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const { normalizedValue, reviewReasons } = validateFieldValue({
    type: source.type,
    required: source.required,
    config: source.config as FieldConfig,
    finalValue: parsed.data.finalValue,
  });

  const updated = await prisma.fieldValue.update({
    where: { id: fieldValueId },
    data: {
      finalValue: parsed.data.finalValue,
      normalizedValue,
      valueSource: "user",
      reviewStatus: reviewReasons.length === 0 ? "confirmed" : "needs_review",
      reviewReasons: reviewReasons as unknown as Prisma.InputJsonValue,
    },
  });

  // PRD_양식편집기_상세 §4.3: 합격/불합격처럼 동시 true 불가로 지정된 체크 필드 쌍은
  // 교차 검증한다 (choice_conflict).
  const checkConfig = current.field?.type === "check" ? (source.config as FieldConfig).check : undefined;
  const exclusiveWithFieldId = (checkConfig as CheckConfig | undefined)?.exclusiveWithFieldId;
  if (current.field && exclusiveWithFieldId) {
    await syncExclusivePair(documentId, current.field.id, exclusiveWithFieldId);
    // syncExclusivePair may have changed this exact row's status right after the write above.
    const fresh = await prisma.fieldValue.findUnique({ where: { id: fieldValueId } });
    return Response.json(fresh ?? updated);
  }

  return Response.json(updated);
}

async function syncExclusivePair(documentId: string, fieldAId: string, fieldBId: string) {
  const [valueA, valueB] = await Promise.all([
    prisma.fieldValue.findFirst({ where: { documentId, fieldId: fieldAId } }),
    prisma.fieldValue.findFirst({ where: { documentId, fieldId: fieldBId } }),
  ]);
  if (!valueA || !valueB) return;

  const bothTrue = valueA.normalizedValue === "true" && valueB.normalizedValue === "true";

  for (const v of [valueA, valueB]) {
    const withoutConflict = (v.reviewReasons as unknown as ReviewReason[]).filter((r) => r !== "choice_conflict");
    const nextReasons = bothTrue ? [...withoutConflict, "choice_conflict" as const] : withoutConflict;
    await prisma.fieldValue.update({
      where: { id: v.id },
      data: {
        reviewReasons: nextReasons as unknown as Prisma.InputJsonValue,
        reviewStatus: nextReasons.length === 0 ? "confirmed" : "needs_review",
      },
    });
  }
}
