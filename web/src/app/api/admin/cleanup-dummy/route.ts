import { prisma } from "@/lib/prisma";

// 일회성 정리용 라우트 — 배포 사이트에 남아있던 더미 인쇄 테스트 문서(N-{timestamp}-{random}
// 형식의 구 ncode)를 지운다. 사용자가 문서 조회 화면에서 직접 확인한 ncode 3건만 대상으로
// 한다(2026-08-25). 작업 후 이 라우트 자체를 삭제할 예정이므로 인증은 최소한으로만 둔다.
const TARGET_NCODES = [
  "N-1787548062504-9c7ba091",
  "N-1787537755248-e5ae52e8",
  "N-1787532919268-6b23dd6c",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("confirm") !== "yes") {
    return Response.json({ error: "PASS ?confirm=yes TO EXECUTE", targets: TARGET_NCODES }, { status: 400 });
  }

  const docs = await prisma.document.findMany({ where: { ncode: { in: TARGET_NCODES } }, select: { id: true, ncode: true } });
  const ids = docs.map((d) => d.id);

  if (ids.length === 0) {
    return Response.json({ deleted: 0, message: "No matching documents found." });
  }

  await prisma.$transaction([
    prisma.fieldValue.deleteMany({ where: { documentId: { in: ids } } }),
    prisma.aiJob.deleteMany({ where: { documentId: { in: ids } } }),
    prisma.export.deleteMany({ where: { documentId: { in: ids } } }),
    prisma.document.deleteMany({ where: { id: { in: ids } } }),
  ]);

  return Response.json({ deleted: ids.length, ncodes: docs.map((d) => d.ncode) });
}
