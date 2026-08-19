import { prisma } from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/schemas";

// PRD_폼솔루션 §6 양식 관리 목록: 양식 ID, 양식명, 페이지, 필드 수, 프린트 상태, 등록일, 수정일.
export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { updatedAt: "desc" },
    include: { org: { select: { name: true } }, versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });

  const withCounts = await Promise.all(
    templates.map(async (t) => {
      const version = t.versions[0];
      const [fieldCount, groupCount] = version
        ? await Promise.all([
            prisma.field.count({ where: { templateVersionId: version.id } }),
            prisma.repeatGroup.count({ where: { templateVersionId: version.id } }),
          ])
        : [0, 0];
      return {
        id: t.id,
        orgId: t.orgId,
        name: t.name,
        status: t.status,
        printable: t.printable,
        printableReason: t.printableReason,
        currentVersionId: t.currentVersionId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        org: t.org,
        pageCount: version?.pageCount ?? 1,
        fieldCount: fieldCount + groupCount,
      };
    })
  );

  return Response.json(withCounts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }
  const { orgId, name, pageCount } = parsed.data;

  const template = await prisma.template.create({
    data: {
      orgId,
      name,
      status: "draft",
      versions: {
        create: {
          versionNo: 1,
          pageCount,
        },
      },
    },
    include: { versions: true },
  });

  const version = template.versions[0];
  const updated = await prisma.template.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
    include: { versions: true },
  });

  return Response.json(updated, { status: 201 });
}
