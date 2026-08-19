import { prisma } from "@/lib/prisma";
import { getCurrentVersion, NotFoundError } from "@/lib/template";
import { validateFields } from "@/lib/validateFields";

export async function POST(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/validate">) {
  const { templateId } = await ctx.params;
  try {
    const { version } = await getCurrentVersion(templateId);
    const fields = await prisma.field.findMany({ where: { templateVersionId: version.id } });
    const issues = validateFields(
      fields.map((f) => ({
        id: f.id,
        pageNo: f.pageNo,
        dataKey: f.dataKey,
        boxX: f.boxX,
        boxY: f.boxY,
        boxW: f.boxW,
        boxH: f.boxH,
      }))
    );
    return Response.json({ valid: issues.length === 0, issues });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
