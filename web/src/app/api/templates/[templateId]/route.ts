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

  const { printable, ...rest } = parsed.data;
  if (printable !== undefined) {
    const current = await prisma.template.findUnique({ where: { id: templateId } });
    if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    // 편집 미완료(draft) 양식은 구조 검사를 통과한 적이 없으므로 사용자가 강제로 Printable로
    // 바꿀 수 없다 — activate()만 이 상태를 바꿀 수 있다 (PRD §7.1.1).
    if (current.status === "draft" && printable) {
      return Response.json({ error: "TEMPLATE_NOT_ACTIVATED" }, { status: 409 });
    }
  }

  const template = await prisma.template.update({
    where: { id: templateId },
    data: {
      ...rest,
      ...(printable !== undefined
        ? { printable, printableReason: printable ? null : "사용자가 프린트 중지" }
        : {}),
    },
  });
  return Response.json(template);
}
