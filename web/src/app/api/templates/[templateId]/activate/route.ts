import { prisma } from "@/lib/prisma";
import { getCurrentVersion, loadValidationInput, NotFoundError } from "@/lib/template";
import { validateFields } from "@/lib/validateFields";

// PRD_폼솔루션 §7.1.1: 편집 중 → 인쇄 가능 (1차 데모 단순화된 상태 전이)
export async function POST(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/activate">) {
  const { templateId } = await ctx.params;
  try {
    const { version } = await getCurrentVersion(templateId);
    const { fields, repeatGroups } = await loadValidationInput(version.id);

    // 실패 사유는 이 응답에만 담아 편집기에서 즉시 보여주는 용도로 쓰고, DB에는 남기지
    // 않는다 — 화면을 새로고침하거나 목록에서 다시 봤을 때 지난 실패 사유가 마치 지금도
    // 유효한 상태인 것처럼 계속 표시되는 문제(과거 "사용자가 프린트 중지" 잔존 버그)를 피한다.
    if (fields.length === 0 && repeatGroups.length === 0) {
      const template = await prisma.template.findUnique({ where: { id: templateId } });
      return Response.json({ error: "VALIDATION_FAILED", reason: "편집 미완료 — 필드가 없습니다.", template }, { status: 409 });
    }

    const issues = validateFields(fields, repeatGroups);

    if (issues.length > 0) {
      const template = await prisma.template.findUnique({ where: { id: templateId } });
      return Response.json({ error: "VALIDATION_FAILED", issues, reason: "구조 오류", template }, { status: 409 });
    }

    const template = await prisma.template.update({
      where: { id: templateId },
      data: { status: "printable", printableReason: null },
    });
    return Response.json(template);
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
