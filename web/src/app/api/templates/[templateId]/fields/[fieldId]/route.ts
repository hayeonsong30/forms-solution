import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { updateFieldSchema, defaultConfigForType, type FieldConfig } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";
import { assertTemplateEditableByVersion, existingDataKeys, TemplateLockedError } from "@/lib/template";

export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/templates/[templateId]/fields/[fieldId]">
) {
  const { fieldId } = await ctx.params;
  const body = await req.json();
  const parsed = updateFieldSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  const current = await prisma.field.findUnique({ where: { id: fieldId } });
  if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await assertTemplateEditableByVersion(current.templateVersionId);
  } catch (e) {
    if (e instanceof TemplateLockedError) return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    throw e;
  }
  if (current.locked && (parsed.data.box || parsed.data.dataKey || parsed.data.type)) {
    return Response.json({ error: "FIELD_LOCKED" }, { status: 409 });
  }

  const { box, dataKey, config, type, choiceOptions, ...rest } = parsed.data;

  let nextDataKey: string | undefined;
  if (dataKey) {
    const base = slugifyDataKey(dataKey, type ?? current.type);
    if (base !== current.dataKey) {
      const keys = await existingDataKeys(current.templateVersionId);
      keys.delete(current.dataKey);
      nextDataKey = withUniqueSuffix(base, keys);
    }
  }

  let nextConfig: Prisma.InputJsonValue | undefined;
  if (type && type !== current.type) {
    nextConfig = defaultConfigForType(type, config ?? {}) as Prisma.InputJsonValue;
  } else if (config) {
    const currentConfig = (current.config ?? {}) as FieldConfig;
    nextConfig = {
      ...currentConfig,
      ...config,
      text: config.text ? { ...currentConfig.text, ...config.text } : currentConfig.text,
      number: config.number ? { ...currentConfig.number, ...config.number } : currentConfig.number,
      check: config.check ? { ...currentConfig.check, ...config.check } : currentConfig.check,
      date: config.date ? { ...currentConfig.date, ...config.date } : currentConfig.date,
      time: config.time ? { ...currentConfig.time, ...config.time } : currentConfig.time,
      choice: config.choice ? { ...currentConfig.choice, ...config.choice } : currentConfig.choice,
    } as Prisma.InputJsonValue;
  }

  const field = await prisma.$transaction(async (tx) => {
    const updated = await tx.field.update({
      where: { id: fieldId },
      data: {
        ...rest,
        ...(type ? { type } : {}),
        ...(nextDataKey ? { dataKey: nextDataKey } : {}),
        ...(box ? { boxX: box.x, boxY: box.y, boxW: box.w, boxH: box.h } : {}),
        ...(nextConfig ? { config: nextConfig } : {}),
      },
    });
    if (choiceOptions) {
      await tx.choiceOption.deleteMany({ where: { fieldId } });
      if (choiceOptions.length > 0) {
        await tx.choiceOption.createMany({
          data: choiceOptions.map((o, i) => ({
            fieldId,
            orderNo: i,
            label: o.label,
            storedValue: o.storedValue,
            regionX: o.region?.x,
            regionY: o.region?.y,
            regionW: o.region?.w,
            regionH: o.region?.h,
          })),
        });
      }
    }
    const withOptions = await tx.field.findUnique({
      where: { id: fieldId },
      include: { choiceOptions: { orderBy: { orderNo: "asc" } } },
    });
    return withOptions ?? updated;
  });
  return Response.json(field);
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/templates/[templateId]/fields/[fieldId]">
) {
  const { fieldId } = await ctx.params;
  const current = await prisma.field.findUnique({ where: { id: fieldId } });
  if (!current) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await assertTemplateEditableByVersion(current.templateVersionId);
  } catch (e) {
    if (e instanceof TemplateLockedError) return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    throw e;
  }
  if (current.locked) {
    return Response.json({ error: "FIELD_LOCKED" }, { status: 409 });
  }
  await prisma.field.delete({ where: { id: fieldId } });
  return new Response(null, { status: 204 });
}
