import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { defaultConfigForType } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";
import { assertTemplateEditableByVersion, existingDataKeys, TemplateLockedError } from "@/lib/template";

// "선택 필드로 묶기"의 역방향: 병합된 choice 필드를 각 옵션의 판정 영역(region) 기준으로
// 다시 개별 체크 필드 N개로 복원한다. 옵션에 영역이 없으면(영역 미지정) 복원할 좌표가
// 없으므로 거부한다.
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/templates/[templateId]/fields/[fieldId]/split-choice">
) {
  const { fieldId } = await ctx.params;
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: { choiceOptions: { orderBy: { orderNo: "asc" } } },
  });
  if (!field) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await assertTemplateEditableByVersion(field.templateVersionId);
  } catch (e) {
    if (e instanceof TemplateLockedError) return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    throw e;
  }
  if (field.type !== "choice") {
    return Response.json({ error: "NOT_A_CHOICE_FIELD" }, { status: 400 });
  }
  if (field.choiceOptions.length === 0) {
    return Response.json({ error: "NO_OPTIONS" }, { status: 400 });
  }
  if (field.choiceOptions.some((o) => o.regionX === null || o.regionY === null || o.regionW === null || o.regionH === null)) {
    return Response.json({ error: "OPTION_MISSING_REGION" }, { status: 400 });
  }

  const keys = await existingDataKeys(field.templateVersionId);
  keys.delete(field.dataKey);

  const restored = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const o of field.choiceOptions) {
      const base = slugifyDataKey(o.storedValue || o.label, "check");
      const dataKey = withUniqueSuffix(base, keys);
      keys.add(dataKey);
      created.push(
        await tx.field.create({
          data: {
            templateVersionId: field.templateVersionId,
            pageNo: field.pageNo,
            label: o.label,
            dataKey,
            type: "check",
            boxX: o.regionX!,
            boxY: o.regionY!,
            boxW: o.regionW!,
            boxH: o.regionH!,
            required: field.required,
            source: "manual",
            status: "confirmed",
            config: defaultConfigForType("check") as Prisma.InputJsonValue,
          },
        })
      );
    }
    await tx.field.delete({ where: { id: fieldId } });
    return created;
  });

  return Response.json(restored, { status: 201 });
}
