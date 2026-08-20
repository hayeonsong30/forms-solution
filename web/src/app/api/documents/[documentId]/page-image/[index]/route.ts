import { prisma } from "@/lib/prisma";
import { parseDataUri } from "@/lib/dataUri";

// 문서 상세 화면의 "작성 원본" 뷰어용 — pageImages는 base64라 문서 조회 응답 자체에는
// 안 실어 보내고(무거움), 이 엔드포인트에서 페이지 1장씩 바이너리로 내려준다.
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[documentId]/page-image/[index]">) {
  const { documentId, index } = await ctx.params;
  const pageIndex = Number(index);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return Response.json({ error: "INVALID_INDEX" }, { status: 400 });
  }

  const document = await prisma.document.findUnique({ where: { id: documentId }, select: { pageImages: true } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const pageImages = document.pageImages as unknown as string[];
  const dataUri = pageImages[pageIndex];
  if (!dataUri) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const parsed = parseDataUri(dataUri);
  if (!parsed) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const bytes = Buffer.from(parsed.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": parsed.mimeType, "Cache-Control": "private, max-age=60" },
  });
}
