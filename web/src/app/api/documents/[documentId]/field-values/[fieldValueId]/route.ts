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
