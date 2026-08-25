import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[documentId]">) {
  const { documentId } = await ctx.params;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      templateVersion: {
        include: {
          template: { select: { id: true, name: true } },
          // 아직 필기 데이터가 없어 fieldValues가 비어 있어도(예: printed 상태) 문서 상세
          // 화면이 완전히 빈 화면이 되지 않도록, 어떤 필드가 잡혀 있는지 구조를 같이 보낸다.
          fields: {
            orderBy: [{ pageNo: "asc" }, { boxY: "asc" }, { boxX: "asc" }],
            include: { choiceOptions: { orderBy: { orderNo: "asc" } } },
          },
        },
      },
      fieldValues: {
        include: { field: { include: { choiceOptions: { orderBy: { orderNo: "asc" } } } }, repeatColumn: true },
        orderBy: [{ rowIndex: "asc" }],
      },
    },
  });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // 이 문서와 같은 SOBP(ncode)를 쓰는 문서들 — 문서 상세 화면에 "페이지별 SOBP" 바를
  // 보여주는 데 쓴다(PRD_폼솔루션 §14.1). 공유 SOBP가 아니면 자기 자신 1건뿐이다.
  // createdAt 오름차순이 곧 가상번호(페이지) 순서다.
  const siblings = document.ncode
    ? await prisma.document.findMany({
        where: { ncode: document.ncode },
        select: { id: true, ncode: true, createdAt: true, status: true },
        orderBy: { createdAt: "asc" },
      })
    : [{ id: document.id, ncode: document.ncode, createdAt: document.createdAt, status: document.status }];

  // pageImages는 base64 원본 이미지를 담을 수 있어 매 조회마다 실어 보내면 무겁다.
  // 페이지 수만 알려주고, 실제 이미지가 필요하면 별도 엔드포인트에서 받도록 한다.
  const { pageImages, ...rest } = document;
  return Response.json({
    ...rest,
    pageImageCount: (pageImages as unknown as string[]).length,
    siblings,
  });
}
