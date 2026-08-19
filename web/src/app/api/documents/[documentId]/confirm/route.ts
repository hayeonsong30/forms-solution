import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/documentStatus";

// PRD_폼솔루션 §7.9.1: 확정 JSON은 사용자 최종값(final_value)을 원천으로 한다.
// 검수 필요 상태로 남은 값이 있거나 필수 필드가 비어 있으면 확정을 막는다.
export async function POST(_req: Request, ctx: RouteContext<"/api/documents/[documentId]/confirm">) {
  const { documentId } = await ctx.params;
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!canTransition(document.status, "confirmed")) {
    return Response.json({ error: "INVALID_TRANSITION", from: document.status, to: "confirmed" }, { status: 409 });
  }

  const values = await prisma.fieldValue.findMany({
    where: { documentId },
    include: { field: true, repeatColumn: true },
  });

  const unresolved = values.filter((v) => v.reviewStatus === "needs_review");
  const missingRequired = values.filter(
    (v) => v.finalValue === null && (v.field?.required || v.repeatColumn?.required)
  );

  if (unresolved.length > 0 || missingRequired.length > 0) {
    return Response.json(
      {
        error: "VALIDATION_FAILED",
        unresolvedFieldValueIds: unresolved.map((v) => v.id),
        missingRequiredFieldValueIds: missingRequired.map((v) => v.id),
      },
      { status: 409 }
    );
  }

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
  return Response.json(updated);
}
