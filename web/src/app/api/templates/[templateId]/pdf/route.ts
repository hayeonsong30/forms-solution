import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getCurrentVersion, NotFoundError } from "@/lib/template";
import { uploadTemplatePdfSchema } from "@/lib/schemas";

const MAX_BASE64_LENGTH = Math.ceil((20 * 1024 * 1024 * 4) / 3); // 20MB PDF → base64

// PRD_양식편집기_상세 §8.0: PDF가 업로드되기 전까지 필드 추가·AI 자동 추천·필드 설정을 막는다.
export async function POST(req: Request, ctx: RouteContext<"/api/templates/[templateId]/pdf">) {
  const { templateId } = await ctx.params;
  const body = await req.json();
  const parsed = uploadTemplatePdfSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.pdfDataUri.length > MAX_BASE64_LENGTH) {
    return Response.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  try {
    const { template, version } = await getCurrentVersion(templateId);
    if (template.status !== "draft") {
      return Response.json({ error: "TEMPLATE_LOCKED" }, { status: 409 });
    }

    const base64 = parsed.data.pdfDataUri.slice("data:application/pdf;base64,".length);
    await prisma.templateVersion.update({
      where: { id: version.id },
      data: { pdfData: base64, pageCount: parsed.data.pageCount },
    });

    return Response.json({ pageCount: parsed.data.pageCount }, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}

// ?copies=N: 원본 PDF 페이지를 N번 이어붙여 반환한다 — "다운로드"는 예정 인쇄 부수만큼의
// 실물 인쇄용 PDF 한 장을 한 번에 받고 싶다는 요청(2026-08-25)에 대응한다.
export async function GET(req: Request, ctx: RouteContext<"/api/templates/[templateId]/pdf">) {
  const { templateId } = await ctx.params;
  const copies = Math.max(1, Number(new URL(req.url).searchParams.get("copies") ?? "1") || 1);
  try {
    const { version } = await getCurrentVersion(templateId);
    if (!version.pdfData) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const sourceBytes = Buffer.from(version.pdfData, "base64");
    if (copies === 1) {
      return new Response(new Uint8Array(sourceBytes), {
        headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=60" },
      });
    }

    const source = await PDFDocument.load(sourceBytes);
    const out = await PDFDocument.create();
    const pageIndices = source.getPageIndices();
    for (let i = 0; i < copies; i += 1) {
      const copiedPages = await out.copyPages(source, pageIndices);
      copiedPages.forEach((p) => out.addPage(p));
    }
    const outBytes = await out.save();
    return new Response(new Uint8Array(outBytes), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
