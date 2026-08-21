import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { updateRepeatGroupSchema } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";
import { assertTemplateEditableByVersion, TemplateLockedError } from "@/lib/template";

export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/templates/[templateId]/repeat-groups/[groupId]">
) {
  const { groupId } = await ctx.params;
  const body = await req.json();
  const parsed = updateRepeatGroupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const current = await prisma.repeatGroup.findUnique({ where: { id: groupId } });
  if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await assertTemplateEditableByVersion(current.templateVersionId);
  } catch (e) {
    if (e instanceof TemplateLockedError) return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    throw e;
  }

  const { area, rowHeight, maxRows, dataKey, fixedRows, ...rest } = parsed.data;

  let nextDataKey: string | undefined;
  if (dataKey) {
    const base = slugifyDataKey(dataKey, "rows");
    if (base !== current.dataKey) {
      const [fieldKeys, groupKeys] = await Promise.all([
        prisma.field.findMany({ where: { templateVersionId: current.templateVersionId }, select: { dataKey: true } }),
        prisma.repeatGroup.findMany({
          where: { templateVersionId: current.templateVersionId, id: { not: groupId } },
          select: { dataKey: true },
        }),
      ]);
      nextDataKey = withUniqueSuffix(base, new Set([...fieldKeys, ...groupKeys].map((k) => k.dataKey)));
    }
  }

  const nextAreaX = area?.x ?? current.areaX;
  const nextAreaY = area?.y ?? current.areaY;
  const nextAreaW = area?.w ?? current.areaW;
  const nextRowHeight = rowHeight ?? current.rowHeight;
  const nextMaxRows = maxRows ?? current.maxRows;
  const dx = nextAreaX - current.areaX;
  const dy = nextAreaY - current.areaY;

  const group = await prisma.$transaction(async (tx) => {
    if (dx !== 0 || dy !== 0) {
      const columns = await tx.repeatColumn.findMany({
        where: { repeatGroupId: groupId },
        include: { choiceOptions: true },
      });
      await Promise.all(
        columns.map((c) =>
          tx.repeatColumn.update({
            where: { id: c.id },
            data: { boxX: c.boxX + dx, boxY: c.boxY + dy },
          })
        )
      );
      // 컬럼 박스와 마찬가지로, choice 컬럼 안의 옵션 판정 영역(良/否 등)도 그룹 이동량만큼 같이 옮긴다.
      await Promise.all(
        columns.flatMap((c) =>
          c.choiceOptions
            .filter((o) => o.regionX !== null && o.regionY !== null)
            .map((o) =>
              tx.choiceOption.update({
                where: { id: o.id },
                data: { regionX: o.regionX! + dx, regionY: o.regionY! + dy },
              })
            )
        )
      );
    }
    return tx.repeatGroup.update({
      where: { id: groupId },
      data: {
        ...rest,
        ...(nextDataKey ? { dataKey: nextDataKey } : {}),
        ...(fixedRows ? { fixedRows: fixedRows as Prisma.InputJsonValue } : {}),
        areaX: nextAreaX,
        areaY: nextAreaY,
        areaW: nextAreaW,
        rowHeight: nextRowHeight,
        maxRows: nextMaxRows,
        areaH: nextRowHeight * nextMaxRows,
        firstRowArea: { x: nextAreaX, y: nextAreaY, w: nextAreaW, h: nextRowHeight } as Prisma.InputJsonValue,
      },
      include: { columns: { orderBy: { orderNo: "asc" }, include: { choiceOptions: { orderBy: { orderNo: "asc" } } } } },
    });
  });

  return Response.json(group);
}

// PRD_양식편집기_상세 §11.5: 첫 행 필드는 유지, 그룹·행 규칙만 제거
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/templates/[templateId]/repeat-groups/[groupId]">
) {
  const { groupId } = await ctx.params;
  const group = await prisma.repeatGroup.findUnique({
    where: { id: groupId },
    include: { columns: { orderBy: { orderNo: "asc" }, include: { choiceOptions: { orderBy: { orderNo: "asc" } } } } },
  });
  if (!group) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await assertTemplateEditableByVersion(group.templateVersionId);
  } catch (e) {
    if (e instanceof TemplateLockedError) return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    throw e;
  }

  const existingKeys = new Set(
    (await prisma.field.findMany({ where: { templateVersionId: group.templateVersionId }, select: { dataKey: true } })).map(
      (f) => f.dataKey
    )
  );

  await prisma.$transaction(async (tx) => {
    for (const col of group.columns) {
      const dataKey = withUniqueSuffix(col.dataKey, existingKeys);
      existingKeys.add(dataKey);
      await tx.field.create({
        data: {
          templateVersionId: group.templateVersionId,
          pageNo: group.pageNo,
          label: col.label,
          dataKey,
          type: col.type,
          boxX: col.boxX,
          boxY: col.boxY,
          boxW: col.boxW,
          boxH: col.boxH,
          required: col.required,
          source: "manual",
          status: "confirmed",
          config: col.config as Prisma.InputJsonValue,
          // 반복행 해제 시 컬럼에 붙어있던 선택 옵션(예: 良/否)도 그대로 필드에 옮겨준다 —
          // 안 옮기면 해제 즉시 옵션 영역 정의가 통째로 사라진다.
          choiceOptions: col.choiceOptions.length
            ? {
                create: col.choiceOptions.map((o) => ({
                  orderNo: o.orderNo,
                  label: o.label,
                  storedValue: o.storedValue,
                  regionX: o.regionX,
                  regionY: o.regionY,
                  regionW: o.regionW,
                  regionH: o.regionH,
                })),
              }
            : undefined,
        },
      });
    }
    await tx.repeatColumn.deleteMany({ where: { repeatGroupId: groupId } });
    await tx.repeatGroup.delete({ where: { id: groupId } });
  });

  return new Response(null, { status: 204 });
}
