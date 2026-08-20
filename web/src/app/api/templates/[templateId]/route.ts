import { prisma } from "@/lib/prisma";
import { getCurrentVersion, NotFoundError } from "@/lib/template";
import { updateTemplateSchema } from "@/lib/schemas";

export async function GET(_req: Request, ctx: RouteContext<"/api/templates/[templateId]">) {
  const { templateId } = await ctx.params;
  try {
    const { template, version } = await getCurrentVersion(templateId);
    const [fields, repeatGroups] = await Promise.all([
      // 필드 목록 기본 순서는 생성 순서가 아니라 문서 상단→하단, 좌→우 위치 순이다
      // (PRD_양식편집기_상세 §7.2: 이 순서가 CSV·JSON 열 순서의 기준이 된다).
      prisma.field.findMany({
        where: { templateVersionId: version.id },
        orderBy: [{ pageNo: "asc" }, { boxY: "asc" }, { boxX: "asc" }],
        include: { choiceOptions: { orderBy: { orderNo: "asc" } } },
      }),
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

  // 2026-08-20: 단일 status 모델. draft = 편집 가능·인쇄 불가, printable = 편집 잠김·인쇄 가능.
  const { status, ...rest } = parsed.data;
  if (status === "printable") {
    const current = await prisma.template.findUnique({ where: { id: templateId } });
    if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    // 편집 미완료(draft) 양식은 구조 검사를 통과한 적이 없으므로 사용자가 강제로 printable로
    // 바꿀 수 없다 — activate()만 이 상태를 바꿀 수 있다.
    if (current.status === "draft") {
      return Response.json({ error: "TEMPLATE_NOT_ACTIVATED" }, { status: 409 });
    }
  }

  // printableReason은 activate() 실패 사유("구조 오류" 등) 전용이다 — 사용자가 직접
  // 상태를 바꿀 때는 설명할 실패가 없으므로 항상 비운다.
  const template = await prisma.template.update({
    where: { id: templateId },
    data: {
      ...rest,
      ...(status !== undefined ? { status, printableReason: null } : {}),
    },
  });
  return Response.json(template);
}

// 이미 발행된 문서가 있는 템플릿은 삭제하지 않는다 — 문서가 참조하는 버전/필드 정의가
// 사라지면 기존 문서 조회·검수가 깨진다.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/templates/[templateId]">) {
  const { templateId } = await ctx.params;
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { versions: { select: { id: true } } },
  });
  if (!template) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const versionIds = template.versions.map((v) => v.id);
  const documentCount = versionIds.length
    ? await prisma.document.count({ where: { templateVersionId: { in: versionIds } } })
    : 0;
  if (documentCount > 0) {
    return Response.json({ error: "TEMPLATE_HAS_DOCUMENTS", documentCount }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.repeatColumn.deleteMany({ where: { repeatGroup: { templateVersionId: { in: versionIds } } } });
    await tx.repeatGroup.deleteMany({ where: { templateVersionId: { in: versionIds } } });
    await tx.field.deleteMany({ where: { templateVersionId: { in: versionIds } } }); // choiceOptions는 cascade
    await tx.templateVersion.deleteMany({ where: { id: { in: versionIds } } });
    await tx.template.delete({ where: { id: templateId } });
  });

  return new Response(null, { status: 204 });
}
