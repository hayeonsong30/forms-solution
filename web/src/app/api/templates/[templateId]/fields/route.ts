import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { existingDataKeys, getCurrentVersion, NotFoundError } from "@/lib/template";
import { createFieldSchema, defaultConfigForType } from "@/lib/schemas";
import { slugifyDataKey, withUniqueSuffix } from "@/lib/dataKey";

export async function POST(req: Request, ctx: RouteContext<"/api/templates/[templateId]/fields">) {
  const { templateId } = await ctx.params;
  const body = await req.json();
  const parsed = createFieldSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { template, version } = await getCurrentVersion(templateId);
    if (template.status !== "draft") {
      return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    }
    if (!version.pdfData) {
      return Response.json({ error: "PDF_REQUIRED" }, { status: 409 });
    }

    const existingKeys = await existingDataKeys(version.id);
    const base = slugifyDataKey(parsed.data.dataKey ?? parsed.data.label, parsed.data.type);
    const dataKey = withUniqueSuffix(base, existingKeys);

    const field = await prisma.field.create({
      data: {
        templateVersionId: version.id,
        pageNo: parsed.data.pageNo,
        label: parsed.data.label,
        description: parsed.data.description,
        dataKey,
        type: parsed.data.type,
        boxX: parsed.data.box.x,
        boxY: parsed.data.box.y,
        boxW: parsed.data.box.w,
        boxH: parsed.data.box.h,
        required: parsed.data.required,
        source: "manual",
        status: "confirmed",
        config: defaultConfigForType(parsed.data.type, parsed.data.config) as Prisma.InputJsonValue,
      },
      include: { choiceOptions: true },
    });

    return Response.json(field, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
