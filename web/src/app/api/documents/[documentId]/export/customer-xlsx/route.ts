import { prisma } from "@/lib/prisma";
import { buildDocDisplayValues } from "@/lib/excelPlaceholders";
import { renderExcelTemplate } from "@/lib/excelTemplateEngine";
import { buildConfirmedJson, flattenToRows } from "@/lib/confirmedJson";
import { rowsToXlsxBuffer } from "@/lib/xlsx";

// PRD_Excel_플레이스홀더_간단버전 §12: 확정 문서만 고객 Excel로 출력한다.
// 고객 템플릿이 없으면 시스템 기본 Excel(자체 포맷)로 대체한다.
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[documentId]/export/customer-xlsx">) {
  const { documentId } = await ctx.params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { templateVersion: { include: { template: { select: { name: true } } } } },
  });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (document.status !== "confirmed") {
    return Response.json({ error: "DOCUMENT_NOT_CONFIRMED" }, { status: 409 });
  }

  const template = await prisma.excelReportTemplate.findUnique({
    where: { templateVersionId: document.templateVersionId },
  });

  let buffer: Buffer;
  if (template && template.status === "active") {
    const values = await buildDocDisplayValues(documentId);
    buffer = await renderExcelTemplate(Buffer.from(template.fileData, "base64"), values);
  } else {
    const json = await buildConfirmedJson(documentId);
    if (!json) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    buffer = await rowsToXlsxBuffer(flattenToRows(json));
  }

  const dateStr = (document.confirmedAt ?? new Date()).toISOString().slice(0, 10);
  const fileName = `${document.templateVersion.template.name}_${document.ncode ?? document.id}_${dateStr}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
