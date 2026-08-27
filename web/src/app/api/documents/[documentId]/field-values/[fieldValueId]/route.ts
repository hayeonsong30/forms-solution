import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { updateFieldValueSchema } from "@/lib/schemas";
import { validateFieldValue } from "@/lib/fieldValueValidation";
import type { FieldConfig } from "@/types";

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

  const document = await prisma.document.findUnique({ where: { id: documentId }, select: { status: true } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  // 확정된 문서는 재검수 절차(reopen) 없이는 값을 고칠 수 없다 — 검수는 안 하는 것으로
  // 결정, 대신 확정 즉시 입력 자체를 막는다(2026-08-27).
  if (document.status === "confirmed") {
    return Response.json({ error: "DOCUMENT_CONFIRMED" }, { status: 409 });
  }

  const current = await prisma.fieldValue.findUnique({
    where: { id: fieldValueId },
    include: { field: { include: { choiceOptions: true } }, repeatColumn: true },
  });
  if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const source = current.field ?? current.repeatColumn;
  if (!source) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const { normalizedValue, reviewReasons } = validateFieldValue({
    type: source.type,
    required: source.required,
    config: source.config as FieldConfig,
    choiceOptions: current.field?.choiceOptions.map((o) => o.storedValue),
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

  return Response.json(updated);
}
