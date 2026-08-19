import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/documentStatus";
import { reopenDocumentSchema } from "@/lib/schemas";

// PRD_폼솔루션 §8: 확정 → 사유 입력 후 재검수 → 검수 필요
export async function POST(req: Request, ctx: RouteContext<"/api/documents/[documentId]/reopen">) {
  const { documentId } = await ctx.params;
  const body = await req.json();
  const parsed = reopenDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!canTransition(document.status, "review_required")) {
    return Response.json({ error: "INVALID_TRANSITION", from: document.status, to: "review_required" }, { status: 409 });
  }

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { status: "review_required", confirmedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      action: "document.reopen",
      targetType: "document",
      targetId: documentId,
      after: { reason: parsed.data.reason },
    },
  });

  return Response.json(updated);
}
