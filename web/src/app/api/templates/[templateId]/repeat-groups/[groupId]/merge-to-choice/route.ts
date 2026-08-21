import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { mergeRepeatColumnsToChoiceSchema, defaultConfigForType } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";
import { assertTemplateEditableByVersion, TemplateLockedError } from "@/lib/template";

// PRD_반복행_기능_구현 §4.3: 反복행 기준행 안에서 良/否처럼 서로 다른 두 영역이 실제로는
// 하나의 단일 선택 값인 경우, 컬럼 여러 개를 선택(choice) 컬럼 하나로 합친다. 각 원본
// 컬럼의 박스를 그대로 옵션 영역으로 재사용한다(필드 버전 merge-to-choice와 동일 패턴).
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/templates/[templateId]/repeat-groups/[groupId]/merge-to-choice">
) {
  const { groupId } = await ctx.params;
  const body = await req.json();
  const parsed = mergeRepeatColumnsToChoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const group = await prisma.repeatGroup.findUnique({ where: { id: groupId } });
  if (!group) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await assertTemplateEditableByVersion(group.templateVersionId);
  } catch (e) {
    if (e instanceof TemplateLockedError) return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    throw e;
  }

  const sources = await prisma.repeatColumn.findMany({
    where: { id: { in: parsed.data.columnIds }, repeatGroupId: groupId },
    orderBy: [{ boxY: "asc" }, { boxX: "asc" }],
  });
  if (sources.length !== parsed.data.columnIds.length) {
    return Response.json({ error: "COLUMN_NOT_FOUND" }, { status: 404 });
  }

  const minX = Math.min(...sources.map((c) => c.boxX));
  const minY = Math.min(...sources.map((c) => c.boxY));
  const maxX = Math.max(...sources.map((c) => c.boxX + c.boxW));
  const maxY = Math.max(...sources.map((c) => c.boxY + c.boxH));

  const existingColumns = await prisma.repeatColumn.findMany({
    where: { repeatGroupId: groupId, id: { notIn: sources.map((c) => c.id) } },
    select: { dataKey: true, orderNo: true },
  });
  const existingKeys = new Set(existingColumns.map((c) => c.dataKey));
  const base = slugifyDataKey(parsed.data.dataKey ?? parsed.data.label, "choice");
  const dataKey = withUniqueSuffix(base, existingKeys);

  const optionKeys = new Set<string>();
  const optionsData = sources.map((c) => {
    const optBase = slugifyDataKey(c.label, "option");
    let storedValue = optBase;
    let i = 2;
    while (optionKeys.has(storedValue)) storedValue = `${optBase}_${i++}`;
    optionKeys.add(storedValue);
    return { label: c.label, storedValue, regionX: c.boxX, regionY: c.boxY, regionW: c.boxW, regionH: c.boxH };
  });
  // 삭제될 컬럼들 중 가장 앞선 순서를 새 컬럼이 물려받는다 — 열 순서(좌→우)가 크게 안 흔들리게.
  const orderNo = Math.min(...sources.map((c) => c.orderNo));

  const column = await prisma.$transaction(async (tx) => {
    const created = await tx.repeatColumn.create({
      data: {
        repeatGroupId: groupId,
        orderNo,
        label: parsed.data.label,
        dataKey,
        type: "choice",
        boxX: minX,
        boxY: minY,
        boxW: maxX - minX,
        boxH: maxY - minY,
        required: false,
        config: defaultConfigForType("choice", { choice: { mode: parsed.data.mode } }) as Prisma.InputJsonValue,
        choiceOptions: { create: optionsData.map((o, i) => ({ ...o, orderNo: i })) },
      },
      include: { choiceOptions: { orderBy: { orderNo: "asc" } } },
    });
    await tx.repeatColumn.deleteMany({ where: { id: { in: sources.map((c) => c.id) } } });
    return created;
  });

  return Response.json(column, { status: 201 });
}
