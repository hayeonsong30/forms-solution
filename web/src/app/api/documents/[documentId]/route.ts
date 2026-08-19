import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[documentId]">) {
  const { documentId } = await ctx.params;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      templateVersion: { include: { template: { select: { name: true } } } },
      fieldValues: {
        include: { field: true, repeatColumn: true },
        orderBy: [{ rowIndex: "asc" }],
      },
    },
  });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  // pageImages는 base64 원본 이미지를 담을 수 있어 매 조회마다 실어 보내면 무겁다.
  // 페이지 수만 알려주고, 실제 이미지가 필요하면 별도 엔드포인트에서 받도록 한다.
  const { pageImages, ...rest } = document;
  return Response.json({ ...rest, pageImageCount: (pageImages as unknown as string[]).length });
}
