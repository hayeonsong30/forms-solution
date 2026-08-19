import { prisma } from "@/lib/prisma";

export class NotFoundError extends Error {}

// 데이터 키는 필드/반복행 그룹을 통틀어 버전 내에서 유일해야 한다 (확정 JSON에서 같은 레벨의 키가 되므로).
export async function existingDataKeys(templateVersionId: string): Promise<Set<string>> {
  const [fields, groups] = await Promise.all([
    prisma.field.findMany({ where: { templateVersionId }, select: { dataKey: true } }),
    prisma.repeatGroup.findMany({ where: { templateVersionId }, select: { dataKey: true } }),
  ]);
  return new Set([...fields, ...groups].map((r) => r.dataKey));
}

export async function loadValidationInput(templateVersionId: string) {
  const [fields, repeatGroups] = await Promise.all([
    prisma.field.findMany({ where: { templateVersionId } }),
    prisma.repeatGroup.findMany({ where: { templateVersionId } }),
  ]);
  return {
    fields: fields.map((f) => ({
      id: f.id,
      pageNo: f.pageNo,
      dataKey: f.dataKey,
      boxX: f.boxX,
      boxY: f.boxY,
      boxW: f.boxW,
      boxH: f.boxH,
    })),
    repeatGroups: repeatGroups.map((g) => ({
      id: g.id,
      pageNo: g.pageNo,
      dataKey: g.dataKey,
      boxX: g.areaX,
      boxY: g.areaY,
      boxW: g.areaW,
      boxH: g.areaH,
      rowHeight: g.rowHeight,
      maxRows: g.maxRows,
    })),
  };
}

// PRD_폼솔루션 §7.1.1: "편집 완료하면...PDF, 필드, 데이터 키, 영역 좌표를 더 이상 수정할 수 없다."
// draft가 아닌 템플릿(활성/폐기)에 속한 필드·반복행은 서버에서도 수정을 막는다.
export async function assertTemplateEditableByVersion(templateVersionId: string): Promise<void> {
  const version = await prisma.templateVersion.findUnique({
    where: { id: templateVersionId },
    include: { template: { select: { status: true } } },
  });
  if (version && version.template.status !== "draft") {
    throw new TemplateLockedError();
  }
}

export class TemplateLockedError extends Error {}

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
