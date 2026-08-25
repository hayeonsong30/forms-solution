import { prisma } from "@/lib/prisma";
import { updateOrgSchema } from "@/lib/schemas";

// 로그인 기능이 없어서 지금은 데모 고객사 1곳뿐이지만, 프로필 화면에서 회사명은 실제
// Organization.name을 바꾼다 — 이 앱 전체(LNB·양식목록 Owner 열 등)에서 그대로 보인다.
export async function PATCH(req: Request, ctx: RouteContext<"/api/orgs/[orgId]">) {
  const { orgId } = await ctx.params;
  const body = await req.json();
  const parsed = updateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const org = await prisma.organization.update({ where: { id: orgId }, data: { name: parsed.data.name } });
  return Response.json(org);
}
