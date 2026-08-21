import { prisma } from "@/lib/prisma";
import { excelTemplateTypeSchema } from "@/lib/schemas";

// PRD_Excel_플레이스홀더_간단버전 §5, §12: 고객이 올린 원본 파일은 절대 덮어쓰지 않는다 — 저장된 그대로 내려준다.
export async function GET(req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-template/download">) {
  const { versionId } = await ctx.params;
  const type = excelTemplateTypeSchema.safeParse(new URL(req.url).searchParams.get("type"));
  if (!type.success) return Response.json({ error: "VALIDATION_FAILED" }, { status: 400 });

  const template = await prisma.excelReportTemplate.findUnique({
    where: { templateVersionId_type: { templateVersionId: versionId, type: type.data } },
  });
  if (!template) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const buffer = Buffer.from(template.fileData, "base64");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(template.fileName)}"`,
    },
  });
}
