import { getCurrentVersion, loadValidationInput, NotFoundError } from "@/lib/template";
import { validateFields } from "@/lib/validateFields";

export async function POST(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/validate">) {
  const { templateId } = await ctx.params;
  try {
    const { version } = await getCurrentVersion(templateId);
    const { fields, repeatGroups } = await loadValidationInput(version.id);
    const issues = validateFields(fields, repeatGroups);
    return Response.json({ valid: issues.length === 0, issues });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
