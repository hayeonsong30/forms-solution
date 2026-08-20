import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/documentStatus";
import { runOcrPipeline } from "@/lib/runOcr";

// 2026-08-20: 예전엔 OCR이 뭘 읽든 무조건 "검수 필요"로 놓고 사람이 14개 필드를 전부
// 손으로 만져야 다음 단계로 갈 수 있었다 — 화면에서 바로 보고 고칠 수 있는데 그 정도
// 강제 검수는 매 문서마다 불필요한 클릭 노동이라는 피드백으로 없앴다. 이제는 실제 검증
// 규칙(validateFieldValue — 필수값 누락·형식 오류 등)을 통과한 값만 바로 confirmed로
// 놓고, 진짜 문제가 있는 필드만 "확인 필요"로 남긴다. review_reasons의
// manual_review_requested는 OCR을 아예 못 돌린 스텁 케이스에서만 쓴다.
// 실제 실행 로직은 lib/runOcr.ts에 있다 — demo-reprocess/route.ts와 공유한다.
export async function POST(_req: Request, ctx: RouteContext<"/api/documents/[documentId]/process">) {
  const { documentId } = await ctx.params;
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!canTransition(document.status, "processing")) {
    return Response.json({ error: "INVALID_TRANSITION", from: document.status, to: "processing" }, { status: 409 });
  }

  const result = await runOcrPipeline(documentId);
  if (!result.ok) {
    return Response.json({ error: result.error, message: result.message }, { status: result.status });
  }
  const updated = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  return Response.json(updated);
}
