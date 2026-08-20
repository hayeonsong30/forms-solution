import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { existingDataKeys, getCurrentVersion, NotFoundError } from "@/lib/template";
import { mergeToChoiceSchema, defaultConfigForType } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";

// 이미 좌표가 잡혀 있는 개별 필드(주로 check) 여러 개를 선택 필드 하나로 묶는다.
// 옵션 영역을 새로 그리지 않고 각 원본 필드의 박스를 그대로 옵션 영역으로 재사용한다
// (PRD_양식편집기_상세 §14.1 "선택 옵션별 판정 영역" — 이미 AI/수동으로 정확히 잡힌
// 좌표를 버리고 다시 그리게 하지 않는다).
export async function POST(req: Request, ctx: RouteContext<"/api/templates/[templateId]/fields/merge-to-choice">) {
  const { templateId } = await ctx.params;
  const body = await req.json();
  const parsed = mergeToChoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { template, version } = await getCurrentVersion(templateId);
    if (template.status !== "draft") {
      return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    }

    const sources = await prisma.field.findMany({
      where: { id: { in: parsed.data.fieldIds }, templateVersionId: version.id },
      orderBy: [{ boxY: "asc" }, { boxX: "asc" }],
    });
    if (sources.length !== parsed.data.fieldIds.length) {
      return Response.json({ error: "FIELD_NOT_FOUND" }, { status: 404 });
    }
    if (sources.some((f) => f.locked)) {
      return Response.json({ error: "FIELD_LOCKED" }, { status: 409 });
    }
    const pageNo = sources[0].pageNo;
    if (sources.some((f) => f.pageNo !== pageNo)) {
      return Response.json({ error: "FIELDS_MUST_SHARE_PAGE" }, { status: 400 });
    }

    const minX = Math.min(...sources.map((f) => f.boxX));
    const minY = Math.min(...sources.map((f) => f.boxY));
    const maxX = Math.max(...sources.map((f) => f.boxX + f.boxW));
    const maxY = Math.max(...sources.map((f) => f.boxY + f.boxH));

    const existingKeys = await existingDataKeys(version.id);
    const base = slugifyDataKey(parsed.data.dataKey ?? parsed.data.label, "choice");
    const dataKey = withUniqueSuffix(base, existingKeys);
    existingKeys.add(dataKey);

    const optionKeys = new Set<string>();
    const optionsData = sources.map((f) => {
      const optBase = slugifyDataKey(f.label, "option");
      let storedValue = optBase;
      let i = 2;
      while (optionKeys.has(storedValue)) storedValue = `${optBase}_${i++}`;
      optionKeys.add(storedValue);
      return { label: f.label, storedValue, regionX: f.boxX, regionY: f.boxY, regionW: f.boxW, regionH: f.boxH };
    });

    const field = await prisma.$transaction(async (tx) => {
      const created = await tx.field.create({
        data: {
          templateVersionId: version.id,
          pageNo,
          label: parsed.data.label,
          dataKey,
          type: "choice",
          boxX: minX,
          boxY: minY,
          boxW: maxX - minX,
          boxH: maxY - minY,
          required: false,
          source: "manual",
          status: "confirmed",
          config: defaultConfigForType("choice", { choice: { mode: parsed.data.mode } }) as Prisma.InputJsonValue,
          choiceOptions: { create: optionsData.map((o, i) => ({ ...o, orderNo: i })) },
        },
        include: { choiceOptions: { orderBy: { orderNo: "asc" } } },
      });
      await tx.field.deleteMany({ where: { id: { in: sources.map((f) => f.id) } } });
      return created;
    });

    return Response.json(field, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
