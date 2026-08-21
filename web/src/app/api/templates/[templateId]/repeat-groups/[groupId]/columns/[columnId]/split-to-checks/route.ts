import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { defaultConfigForType } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";
import { assertTemplateEditableByVersion, TemplateLockedError } from "@/lib/template";

// merge-to-choice의 역방향(반복행 컬럼 버전): 병합된 choice 컬럼을 각 옵션의 판정 영역
// 기준으로 다시 개별 체크 컬럼 N개로 복원한다. 컬럼 순서는 x좌표 기준으로 재정렬한다.
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/templates/[templateId]/repeat-groups/[groupId]/columns/[columnId]/split-to-checks">
) {
  const { groupId, columnId } = await ctx.params;
  const column = await prisma.repeatColumn.findUnique({
    where: { id: columnId },
    include: { choiceOptions: { orderBy: { orderNo: "asc" } }, repeatGroup: true },
  });
  if (!column || column.repeatGroupId !== groupId) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await assertTemplateEditableByVersion(column.repeatGroup.templateVersionId);
  } catch (e) {
    if (e instanceof TemplateLockedError) return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    throw e;
  }
  if (column.type !== "choice") {
    return Response.json({ error: "NOT_A_CHOICE_COLUMN" }, { status: 400 });
  }
  if (column.choiceOptions.length === 0) {
    return Response.json({ error: "NO_OPTIONS" }, { status: 400 });
  }
  if (column.choiceOptions.some((o) => o.regionX === null || o.regionY === null || o.regionW === null || o.regionH === null)) {
    return Response.json({ error: "OPTION_MISSING_REGION" }, { status: 400 });
  }

  const siblingKeys = new Set(
    (
      await prisma.repeatColumn.findMany({
        where: { repeatGroupId: groupId, id: { not: columnId } },
        select: { dataKey: true },
      })
    ).map((c) => c.dataKey)
  );

  const group = await prisma.$transaction(async (tx) => {
    for (const o of column.choiceOptions) {
      const base = slugifyDataKey(o.storedValue || o.label, "check");
      const dataKey = withUniqueSuffix(base, siblingKeys);
      siblingKeys.add(dataKey);
      await tx.repeatColumn.create({
        data: {
          repeatGroupId: groupId,
          orderNo: 0, // 아래에서 x좌표 기준으로 다시 매긴다
          label: o.label,
          dataKey,
          type: "check",
          boxX: o.regionX!,
          boxY: o.regionY!,
          boxW: o.regionW!,
          boxH: o.regionH!,
          required: column.required,
          config: defaultConfigForType("check") as Prisma.InputJsonValue,
        },
      });
    }
    await tx.repeatColumn.delete({ where: { id: columnId } });

    const remaining = await tx.repeatColumn.findMany({ where: { repeatGroupId: groupId }, orderBy: { boxX: "asc" } });
    await Promise.all(remaining.map((c, i) => tx.repeatColumn.update({ where: { id: c.id }, data: { orderNo: i } })));

    return tx.repeatGroup.findUnique({
      where: { id: groupId },
      include: { columns: { orderBy: { orderNo: "asc" }, include: { choiceOptions: { orderBy: { orderNo: "asc" } } } } },
    });
  });

  return Response.json(group, { status: 201 });
}
