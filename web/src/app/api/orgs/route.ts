import { prisma } from "@/lib/prisma";

export async function GET() {
  const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
  return Response.json(orgs);
}
