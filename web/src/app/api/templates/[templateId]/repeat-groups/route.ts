import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentVersion, NotFoundError } from "@/lib/template";
import { createRepeatGroupSchema } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";

// PRD_양식편집기_상세 §11.1~11.3: 첫 행 필드 다중선택 → "반복행으로 묶기".
// 열은 첫 행 필드들의 좌→우 순서로 자동 정의하고, 행 높이는 기준행 상단~최하단 필드 하단으로 계산한다.
export async function POST(req: Request, ctx: RouteContext<"/api/templates/[templateId]/repeat-groups">) {
  const { templateId } = await ctx.params;
  const body = await req.json();
  const parsed = createRepeatGroupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { template, version } = await getCurrentVersion(templateId);
    if (template.status !== "draft") {
      return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    }
    const fields = await prisma.field.findMany({
      where: { id: { in: parsed.data.fieldIds }, templateVersionId: version.id },
    });
    if (fields.length !== parsed.data.fieldIds.length) {
      return Response.json({ error: "FIELD_NOT_FOUND" }, { status: 404 });
    }
    const pageNo = fields[0].pageNo;
    if (fields.some((f) => f.pageNo !== pageNo)) {
      return Response.json({ error: "FIELDS_MUST_SHARE_PAGE" }, { status: 400 });
    }
    if (fields.some((f) => f.locked)) {
      return Response.json({ error: "FIELD_LOCKED" }, { status: 409 });
    }

    const sorted = [...fields].sort((a, b) => a.boxX - b.boxX);
    const areaX = Math.min(...fields.map((f) => f.boxX));
    const areaY = Math.min(...fields.map((f) => f.boxY));
    const areaRight = Math.max(...fields.map((f) => f.boxX + f.boxW));
    const areaBottom = Math.max(...fields.map((f) => f.boxY + f.boxH));
    const areaW = areaRight - areaX;
    const rowHeight = areaBottom - areaY;

    const [existingFieldKeys, existingGroupKeys] = await Promise.all([
      prisma.field.findMany({ where: { templateVersionId: version.id }, select: { dataKey: true } }),
      prisma.repeatGroup.findMany({ where: { templateVersionId: version.id }, select: { dataKey: true } }),
    ]);
    const existingKeys = new Set([...existingFieldKeys, ...existingGroupKeys].map((k) => k.dataKey));
    const base = slugifyDataKey(parsed.data.dataKey ?? parsed.data.label, "rows");
    const dataKey = withUniqueSuffix(base, existingKeys);

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.repeatGroup.create({
        data: {
          templateVersionId: version.id,
          label: parsed.data.label,
          dataKey,
          pageNo,
          areaX,
          areaY,
          areaW,
          areaH: rowHeight * parsed.data.maxRows,
          firstRowArea: { x: areaX, y: areaY, w: areaW, h: rowHeight } as Prisma.InputJsonValue,
          rowHeight,
          maxRows: parsed.data.maxRows,
          blankRowPolicy: parsed.data.blankRowPolicy,
          useRowNumber: parsed.data.useRowNumber,
          allowDuplicate: parsed.data.allowDuplicate,
          columns: {
            create: sorted.map((f, idx) => ({
              orderNo: idx,
              label: f.label,
              dataKey: f.dataKey,
              type: f.type,
              boxX: f.boxX,
              boxY: f.boxY,
              boxW: f.boxW,
              boxH: f.boxH,
              required: f.required,
              config: f.config as Prisma.InputJsonValue,
            })),
          },
        },
        include: { columns: { orderBy: { orderNo: "asc" } } },
      });
      await tx.field.deleteMany({ where: { id: { in: parsed.data.fieldIds } } });
      return created;
    });

    return Response.json(group, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
