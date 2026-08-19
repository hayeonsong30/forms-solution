import { prisma } from "@/lib/prisma";

export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      templateVersionId: true,
      orgId: true,
      ncode: true,
      status: true,
      createdAt: true,
      confirmedAt: true,
      templateVersion: { include: { template: { select: { name: true } } } },
    },
  });
  return Response.json(documents);
}
