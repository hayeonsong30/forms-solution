import JSZip from "jszip";
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

// ?copies=N: 부수만큼의 파일을 각각 담아 반환한다 — 부수 하나하나가 향후 서로 다른
// SOBP 인스턴스가 될 단위라, 이어붙인 PDF 한 장이 아니라 원본 PDF를 N번 복제한 개별
// 파일들을 zip으로 묶어 내려준다(2026-08-26 정책 재정리 — 공유 SOBP 여러 문서를 zip으로
// 내려주는 /api/documents/[documentId]/zip과 동일한 원칙). 부수가 1이면 zip 없이 원본
// PDF를 그대로 반환한다.
export async function GET(req: Request, ctx: RouteContext<"/api/templates/[templateId]/pdf">) {
  const { templateId } = await ctx.params;
  const copies = Math.max(1, Number(new URL(req.url).searchParams.get("copies") ?? "1") || 1);
  try {
    const { template, version } = await getCurrentVersion(templateId);
    if (!version.pdfData) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const sourceBytes = Buffer.from(version.pdfData, "base64");
    if (copies === 1) {
      return new Response(new Uint8Array(sourceBytes), {
        headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=60" },
      });
    }

    const zip = new JSZip();
    const digits = String(copies).length;
    for (let i = 1; i <= copies; i += 1) {
      zip.file(`${template.name}_${String(i).padStart(digits, "0")}.pdf`, sourceBytes);
    }
    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    return new Response(new Uint8Array(zipBytes), {
      headers: { "Content-Type": "application/zip", "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    throw e;
  }
}
