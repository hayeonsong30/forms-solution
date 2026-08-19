import { prisma } from "@/lib/prisma";
import { getCurrentVersion, NotFoundError } from "@/lib/template";
import { updateTemplateSchema } from "@/lib/schemas";

export async function GET(_req: Request, ctx: RouteContext<"/api/templates/[templateId]">) {
  const { templateId } = await ctx.params;
  try {
    const { template, version } = await getCurrentVersion(templateId);
    const [fields, repeatGroups] = await Promise.all([
      prisma.field.findMany({ where: { templateVersionId: version.id }, orderBy: { id: "asc" } }),
      prisma.repeatGroup.findMany({
        where: { templateVersionId: version.id },
        include: { columns: { orderBy: { orderNo: "asc" } } },
      }),
    ]);
    // pdfData는 수 MB짜리 base64라 상세 조회 응답에는 있는지 여부만 알려주고,
    // 실제 바이트는 /api/templates/[id]/pdf에서 따로 받는다.
    const { pdfData, ...versionRest } = version;
    return Response.json({ template, version: { ...versionRest, hasPdf: pdfData !== null }, fields, repeatGroups });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/templates/[templateId]">) {
  const { templateId } = await ctx.params;
  const body = await req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }
  const template = await prisma.template.update({ where: { id: templateId }, data: parsed.data });
  return Response.json(template);
}
