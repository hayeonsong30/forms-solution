import { prisma } from "@/lib/prisma";
import { excelTemplateTypeSchema } from "@/lib/schemas";
import { listPlaceholders, buildSampleValues } from "@/lib/excelPlaceholders";
import { renderExcelTemplate } from "@/lib/excelTemplateEngine";

// PRD_Excel_플레이스홀더_간단버전 §10: 실제 문서 없이 테스트 값으로 치환한 샘플을 내려준다. AI 미호출.
export async function POST(req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-template/sample">) {
  const { versionId } = await ctx.params;
  const type = excelTemplateTypeSchema.safeParse(new URL(req.url).searchParams.get("type"));
  if (!type.success) return Response.json({ error: "VALIDATION_FAILED" }, { status: 400 });

  const template = await prisma.excelReportTemplate.findUnique({
    where: { templateVersionId_type: { templateVersionId: versionId, type: type.data } },
  });
  if (!template || template.status !== "active") return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const placeholders = await listPlaceholders(versionId, { includeRepeat: type.data === "list" });
  const sampleValues = buildSampleValues(placeholders);
  const buffer = await renderExcelTemplate(Buffer.from(template.fileData, "base64"), sampleValues);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sample_${encodeURIComponent(template.fileName)}"`,
    },
  });
}
