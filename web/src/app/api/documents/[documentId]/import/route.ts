import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { canTransition } from "@/lib/documentStatus";
import { importDocumentSchema } from "@/lib/schemas";
import { smartpenImportProvider } from "@/lib/smartpenImport";

// 필기 수신 — 실제 스마트펜 SDK 연동 전까지는 스텁 provider가 전달받은 이미지 참조를
// 그대로 통과시킨다.
export async function POST(req: Request, ctx: RouteContext<"/api/documents/[documentId]/import">) {
  const { documentId } = await ctx.params;
  const body = await req.json();
  const parsed = importDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!canTransition(document.status, "received")) {
    return Response.json({ error: "INVALID_TRANSITION", from: document.status, to: "received" }, { status: 409 });
  }

  const result = await smartpenImportProvider.importHandwriting(documentId, parsed.data);
  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { status: "received", pageImages: result.pageImages as Prisma.InputJsonValue, receivedAt: new Date() },
  });
  return Response.json(updated);
}
