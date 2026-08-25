import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { buildConfirmedJson, flattenToRows } from "@/lib/confirmedJson";
import { rowsToCsv } from "@/lib/csv";
import { rowsToXlsxBuffer } from "@/lib/xlsx";

// 공유 SOBP(ncode)로 여러 문서(스캔)가 묶인 경우, 다운로드는 스캔 건수만큼 각각 파일을
// 담아 zip으로 받는다(PRD_폼솔루션 §14.1, 2026-08-25 정책 재정리). 세 가지 형식:
// - format=csv(기본) / format=excel: "편집한 필드 정의 기준으로 변환된" 확정 데이터를
//   스캔별 CSV·Excel로. 아직 확정(confirm) 전인 스캔은 변환할 확정값이 없으므로 제외한다.
// - format=raw: 변환 없이 업로드된 원본 스캔 파일 그대로(확정 여부 무관, 2026-08-25 사용자 확정).
function extensionFor(dataUri: string): string {
  const m = /^data:image\/(\w+);base64,/.exec(dataUri);
  if (m) return m[1] === "jpeg" ? "jpg" : m[1];
  if (dataUri.startsWith("data:application/pdf")) return "pdf";
  return "bin";
}

export async function GET(req: Request, ctx: RouteContext<"/api/documents/[documentId]/zip">) {
  const { documentId } = await ctx.params;
  const formatParam = new URL(req.url).searchParams.get("format");
  const format = formatParam === "raw" || formatParam === "excel" ? formatParam : "csv";
  const target = await prisma.document.findUnique({ where: { id: documentId }, select: { ncode: true } });
  if (!target) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const zip = new JSZip();
  let pageNo = 0;

  if (format === "raw") {
    const siblings = target.ncode
      ? await prisma.document.findMany({ where: { ncode: target.ncode }, select: { pageImages: true }, orderBy: { createdAt: "asc" } })
      : await prisma.document.findMany({ where: { id: documentId }, select: { pageImages: true } });
    for (const sib of siblings) {
      const images = sib.pageImages as unknown as string[];
      for (const dataUri of images) {
        pageNo += 1;
        const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
        zip.file(`page-${pageNo}.${extensionFor(dataUri)}`, base64, { base64: true });
      }
    }
  } else {
    const siblings = target.ncode
      ? await prisma.document.findMany({ where: { ncode: target.ncode, status: "confirmed" }, select: { id: true }, orderBy: { createdAt: "asc" } })
      : await prisma.document.findMany({ where: { id: documentId, status: "confirmed" }, select: { id: true } });
    for (const sib of siblings) {
      const json = await buildConfirmedJson(sib.id);
      if (!json) continue;
      pageNo += 1;
      const rows = flattenToRows(json);
      if (format === "excel") {
        const buffer = await rowsToXlsxBuffer(rows);
        zip.file(`page-${pageNo}.xlsx`, buffer);
      } else {
        zip.file(`page-${pageNo}.csv`, rowsToCsv(rows));
      }
    }
  }

  if (pageNo === 0) {
    return Response.json({ error: "NOT_CONFIRMED" }, { status: 409 });
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${format}-${documentId.slice(0, 8)}.zip"`,
    },
  });
}
