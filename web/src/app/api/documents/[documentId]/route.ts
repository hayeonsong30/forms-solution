import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[documentId]">) {
  const { documentId } = await ctx.params;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      templateVersion: { include: { template: { select: { name: true } } } },
      fieldValues: {
        include: { field: true, repeatColumn: true },
        orderBy: [{ rowIndex: "asc" }],
      },
    },
  });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json(document);
}
