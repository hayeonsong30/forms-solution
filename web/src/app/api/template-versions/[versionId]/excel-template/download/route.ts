import { prisma } from "@/lib/prisma";

// PRD_Excel_플레이스홀더_간단버전 §5, §12: 고객이 올린 원본 파일은 절대 덮어쓰지 않는다 — 저장된 그대로 내려준다.
export async function GET(_req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-template/download">) {
  const { versionId } = await ctx.params;

  const template = await prisma.excelReportTemplate.findUnique({
    where: { templateVersionId: versionId },
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
