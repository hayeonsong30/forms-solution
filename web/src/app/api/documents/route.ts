import { prisma } from "@/lib/prisma";

// PRD_폼솔루션 §7.8: 목록에 OCR 오류 수와 반복행 수를 표시한다.
export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      templateVersionId: true,
      orgId: true,
      ncode: true,
      status: true,
      createdAt: true,
      receivedAt: true,
      confirmedAt: true,
      templateVersion: { select: { pageCount: true, template: { select: { id: true, name: true } } } },
      org: { select: { name: true } },
    },
  });

  const withCounts = await Promise.all(
    documents.map(async (d) => {
      const [needsReviewCount, rowIndexes] = await Promise.all([
        prisma.fieldValue.count({ where: { documentId: d.id, reviewStatus: "needs_review" } }),
        prisma.fieldValue.findMany({
          where: { documentId: d.id, rowIndex: { not: null } },
          select: { rowIndex: true },
          distinct: ["rowIndex"],
        }),
      ]);
      return { ...d, needsReviewCount, repeatRowCount: rowIndexes.length };
    })
  );

  return Response.json(withCounts);
}
