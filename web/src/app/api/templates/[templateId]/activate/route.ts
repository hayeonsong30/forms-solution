import { prisma } from "@/lib/prisma";
import { getCurrentVersion, loadValidationInput, NotFoundError } from "@/lib/template";
import { validateFields } from "@/lib/validateFields";

// PRD_폼솔루션 §7.1.1: 편집 중 → 인쇄 가능 (1차 데모 단순화된 상태 전이)
export async function POST(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/activate">) {
  const { templateId } = await ctx.params;
  try {
    const { version } = await getCurrentVersion(templateId);
    const { fields, repeatGroups } = await loadValidationInput(version.id);

    if (fields.length === 0 && repeatGroups.length === 0) {
      const template = await prisma.template.update({
        where: { id: templateId },
        data: { printable: false, printableReason: "편집 미완료" },
      });
      return Response.json({ error: "VALIDATION_FAILED", template }, { status: 409 });
    }

    const issues = validateFields(fields, repeatGroups);

    if (issues.length > 0) {
      const template = await prisma.template.update({
        where: { id: templateId },
        data: { printable: false, printableReason: "구조 오류" },
      });
      return Response.json({ error: "VALIDATION_FAILED", issues, template }, { status: 409 });
    }

    const template = await prisma.template.update({
      where: { id: templateId },
      data: { printable: true, printableReason: null, status: "active" },
    });
    return Response.json(template);
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
