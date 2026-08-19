import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: RouteContext<"/api/ai/jobs/[jobId]">) {
  const { jobId } = await ctx.params;
  const job = await prisma.aiJob.findUnique({ where: { id: jobId } });
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json(job);
}
