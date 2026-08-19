import { prisma } from "@/lib/prisma";

export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { templateVersion: { include: { template: { select: { name: true } } } } },
  });
  return Response.json(documents);
}
