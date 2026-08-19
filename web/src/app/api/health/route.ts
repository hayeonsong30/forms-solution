import { prisma } from "@/lib/prisma";

export async function GET() {
  const orgCount = await prisma.organization.count();
  return Response.json({ ok: true, orgCount });
}
