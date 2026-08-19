import { prisma } from "@/lib/prisma";

export class NotFoundError extends Error {}

export async function getCurrentVersion(templateId: string) {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) throw new NotFoundError("template not found");

  const version = template.currentVersionId
    ? await prisma.templateVersion.findUnique({ where: { id: template.currentVersionId } })
    : await prisma.templateVersion.findFirst({
        where: { templateId },
        orderBy: { versionNo: "desc" },
      });
  if (!version) throw new NotFoundError("template version not found");

  return { template, version };
}
