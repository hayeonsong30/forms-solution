import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { updateFieldSchema } from "@/lib/schemas";
import { slugifyDataKey } from "@/lib/dataKey";

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
  if (current.locked && (parsed.data.box || parsed.data.dataKey)) {
    return Response.json({ error: "FIELD_LOCKED" }, { status: 409 });
  }

  const { box, dataKey, config, ...rest } = parsed.data;
  const field = await prisma.field.update({
    where: { id: fieldId },
    data: {
      ...rest,
      ...(dataKey ? { dataKey: slugifyDataKey(dataKey) } : {}),
      ...(box ? { boxX: box.x, boxY: box.y, boxW: box.w, boxH: box.h } : {}),
      ...(config ? { config: config as Prisma.InputJsonValue } : {}),
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
