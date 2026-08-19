import { prisma } from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/schemas";

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { id: "desc" },
    include: { org: { select: { name: true } } },
  });
  return Response.json(templates);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }
  const { orgId, name, pageCount } = parsed.data;

  const template = await prisma.template.create({
    data: {
      orgId,
      name,
      status: "draft",
      versions: {
        create: {
          versionNo: 1,
          pageCount,
        },
      },
    },
    include: { versions: true },
  });

  const version = template.versions[0];
  const updated = await prisma.template.update({
    where: { id: template.id },
    data: { currentVersionId: version.id },
    include: { versions: true },
  });

  return Response.json(updated, { status: 201 });
}
