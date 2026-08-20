import { prisma } from "@/lib/prisma";
import { generateNcode } from "@/lib/ncode";

// PRD_폼솔루션 §8: 인쇄 가능한 템플릿만 문서를 발행(인쇄)할 수 있다.
export async function POST(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/documents">) {
  const { templateId } = await ctx.params;
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (template.status !== "printable" || !template.currentVersionId) {
    return Response.json({ error: "TEMPLATE_NOT_PRINTABLE" }, { status: 409 });
  }

  const document = await prisma.document.create({
    data: {
      templateVersionId: template.currentVersionId,
      orgId: template.orgId,
      ncode: generateNcode(),
      status: "printed",
    },
  });
  return Response.json(document, { status: 201 });
}

export async function GET(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/documents">) {
  const { templateId } = await ctx.params;
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const documents = await prisma.document.findMany({
    where: { templateVersion: { templateId } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(documents);
}
