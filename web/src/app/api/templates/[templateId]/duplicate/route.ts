import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/template";

// 실제로 한 매라도 인쇄(=SOBP 발급)한 양식은 편집기에서 다시 편집할 수 없다(2026-08-25,
// 사용자 확정) — 부수를 더 찍고 싶거나 내용을 고치고 싶으면 이 템플릿을 복제해서 새
// draft 양식으로 만든다. 원본의 필드·반복행·Excel 템플릿까지 전부 복사하고, 인쇄
// 부수·상태·PDF는 새로 편집할 수 있도록 초기화한다.
export async function POST(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/duplicate">) {
  const { templateId } = await ctx.params;
  const original = await prisma.template.findUnique({ where: { id: templateId } });
  if (!original) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!original.currentVersionId) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const version = await prisma.templateVersion.findUnique({
    where: { id: original.currentVersionId },
    include: {
      fields: { include: { choiceOptions: { orderBy: { orderNo: "asc" } } } },
      repeatGroups: { include: { columns: { include: { choiceOptions: { orderBy: { orderNo: "asc" } } }, orderBy: { orderNo: "asc" } } } },
      excelReportTemplates: true,
    },
  });
  if (!version) throw new NotFoundError("template version not found");

  const created = await prisma.$transaction(async (tx) => {
    const newTemplate = await tx.template.create({
      data: { orgId: original.orgId, name: `${original.name} (복사본)`, status: "draft" },
    });
    const newVersion = await tx.templateVersion.create({
      data: { templateId: newTemplate.id, versionNo: 1, pageCount: version.pageCount, pdfData: version.pdfData },
    });

    for (const f of version.fields) {
      await tx.field.create({
        data: {
          templateVersionId: newVersion.id,
          pageNo: f.pageNo,
          label: f.label,
          description: f.description,
          dataKey: f.dataKey,
          type: f.type,
          boxX: f.boxX,
          boxY: f.boxY,
          boxW: f.boxW,
          boxH: f.boxH,
          required: f.required,
          locked: f.locked,
          hidden: f.hidden,
          source: f.source,
          status: f.status,
          config: f.config as Prisma.InputJsonValue,
          choiceOptions: {
            create: f.choiceOptions.map((o) => ({
              orderNo: o.orderNo,
              label: o.label,
              storedValue: o.storedValue,
              regionX: o.regionX,
              regionY: o.regionY,
              regionW: o.regionW,
              regionH: o.regionH,
            })),
          },
        },
      });
    }

    for (const g of version.repeatGroups) {
      await tx.repeatGroup.create({
        data: {
          templateVersionId: newVersion.id,
          label: g.label,
          dataKey: g.dataKey,
          pageNo: g.pageNo,
          areaX: g.areaX,
          areaY: g.areaY,
          areaW: g.areaW,
          areaH: g.areaH,
          firstRowArea: g.firstRowArea as Prisma.InputJsonValue,
          headerExcludeArea: g.headerExcludeArea as Prisma.InputJsonValue | undefined,
          rowHeight: g.rowHeight,
          maxRows: g.maxRows,
          blankRowPolicy: g.blankRowPolicy,
          useRowNumber: g.useRowNumber,
          allowDuplicate: g.allowDuplicate,
          fixedRows: g.fixedRows as Prisma.InputJsonValue | undefined,
          columns: {
            create: g.columns.map((c) => ({
              orderNo: c.orderNo,
              label: c.label,
              dataKey: c.dataKey,
              type: c.type,
              boxX: c.boxX,
              boxY: c.boxY,
              boxW: c.boxW,
              boxH: c.boxH,
              required: c.required,
              config: c.config as Prisma.InputJsonValue,
              choiceOptions: {
                create: c.choiceOptions.map((o) => ({
                  orderNo: o.orderNo,
                  label: o.label,
                  storedValue: o.storedValue,
                  regionX: o.regionX,
                  regionY: o.regionY,
                  regionW: o.regionW,
                  regionH: o.regionH,
                })),
              },
            })),
          },
        },
      });
    }

    for (const e of version.excelReportTemplates) {
      await tx.excelReportTemplate.create({
        data: {
          templateVersionId: newVersion.id,
          name: e.name,
          fileName: e.fileName,
          fileData: e.fileData,
          checksum: e.checksum,
          status: e.status,
          placeholderCount: e.placeholderCount,
          validationResult: e.validationResult as Prisma.InputJsonValue,
        },
      });
    }

    return tx.template.update({ where: { id: newTemplate.id }, data: { currentVersionId: newVersion.id } });
  });

  return Response.json(created, { status: 201 });
}
