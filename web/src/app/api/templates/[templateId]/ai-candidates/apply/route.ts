import { prisma } from "@/lib/prisma";
import { applyAiCandidatesSchema } from "@/lib/schemas";

// PRD_폼솔루션 §7.7.10: AI 추천 후보를 일괄 채택/거부한다.
export async function POST(req: Request, ctx: RouteContext<"/api/templates/[templateId]/ai-candidates/apply">) {
  await ctx.params;
  const body = await req.json();
  const parsed = applyAiCandidatesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.field.updateMany({
      where: { id: { in: parsed.data.acceptFieldIds }, status: "suggested" },
      data: { status: "confirmed", source: "ai" },
    }),
    prisma.field.deleteMany({ where: { id: { in: parsed.data.rejectFieldIds }, status: "suggested" } }),
  ]);

  return Response.json({ accepted: parsed.data.acceptFieldIds.length, rejected: parsed.data.rejectFieldIds.length });
}
