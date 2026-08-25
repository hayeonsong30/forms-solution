import { prisma } from "@/lib/prisma";
import { generateNcode } from "@/lib/ncode";

// PRD_폼솔루션 §8: 인쇄 가능한 템플릿만 문서를 발행(인쇄)할 수 있다.
// body.count(기본 1)를 주면 그만큼 한 번에 발행한다 — "인쇄하기"는 설정된 인쇄 부수에서
// 이미 발행된 만큼을 뺀 나머지를 한 번에 채워 넣는다(2026-08-25, 사용자 확정).
export async function POST(req: Request, ctx: RouteContext<"/api/templates/[templateId]/documents">) {
  const { templateId } = await ctx.params;
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (template.status !== "printable" || !template.currentVersionId) {
    return Response.json({ error: "TEMPLATE_NOT_PRINTABLE" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Math.max(1, Math.min(1000, Number(body?.count) || 1));
  const currentVersionId = template.currentVersionId;
  const orgId = template.orgId;

  const version = await prisma.templateVersion.findUnique({ where: { id: currentVersionId }, select: { pageCount: true } });
  const pageCount = version?.pageCount ?? 1;
  // 페이지마다 새 SOBP가 발급되는 게 원칙이라(§14 항목1) 페이지 수만큼 패턴주소를 미리
  // 발급해 pageNcodes에 담는다. ncode(대표값)는 그중 1페이지 것을 그대로 쓴다.
  function newDocumentData() {
    const pageNcodes = Array.from({ length: pageCount }, () => generateNcode());
    return { templateVersionId: currentVersionId, orgId, ncode: pageNcodes[0], pageNcodes, status: "printed" as const };
  }

  if (count === 1) {
    const document = await prisma.document.create({ data: newDocumentData() });
    return Response.json(document, { status: 201 });
  }

  const documents = await Promise.all(Array.from({ length: count }, () => prisma.document.create({ data: newDocumentData() })));
  return Response.json({ count: documents.length, documents }, { status: 201 });
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
