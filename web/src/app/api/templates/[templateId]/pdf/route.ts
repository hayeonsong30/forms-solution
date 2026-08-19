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

export async function GET(_req: Request, ctx: RouteContext<"/api/templates/[templateId]/pdf">) {
  const { templateId } = await ctx.params;
  try {
    const { version } = await getCurrentVersion(templateId);
    if (!version.pdfData) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const bytes = Buffer.from(version.pdfData, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
