import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { updateFieldSchema, defaultConfigForType, type FieldConfig } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";

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
  if (current.locked && (parsed.data.box || parsed.data.dataKey || parsed.data.type)) {
    return Response.json({ error: "FIELD_LOCKED" }, { status: 409 });
  }

  const { box, dataKey, config, type, ...rest } = parsed.data;

  let nextDataKey: string | undefined;
  if (dataKey) {
    const base = slugifyDataKey(dataKey);
    if (base !== current.dataKey) {
      const siblings = await prisma.field.findMany({
        where: { templateVersionId: current.templateVersionId, id: { not: fieldId } },
        select: { dataKey: true },
      });
      nextDataKey = withUniqueSuffix(base, new Set(siblings.map((f) => f.dataKey)));
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
    } as Prisma.InputJsonValue;
  }

  const field = await prisma.field.update({
    where: { id: fieldId },
    data: {
      ...rest,
      ...(type ? { type } : {}),
      ...(nextDataKey ? { dataKey: nextDataKey } : {}),
      ...(box ? { boxX: box.x, boxY: box.y, boxW: box.w, boxH: box.h } : {}),
      ...(nextConfig ? { config: nextConfig } : {}),
    },
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
  if (current.locked) {
    return Response.json({ error: "FIELD_LOCKED" }, { status: 409 });
  }
  await prisma.field.delete({ where: { id: fieldId } });
  return new Response(null, { status: 204 });
}
