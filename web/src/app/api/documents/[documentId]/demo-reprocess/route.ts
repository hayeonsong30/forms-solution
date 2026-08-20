import { prisma } from "@/lib/prisma";
import { runOcrPipeline } from "@/lib/runOcr";

// 데모/시연 전용 — 문서 상태(확정 포함)와 무관하게 AI OCR을 다시 돌린다. 정식 흐름
// (process/route.ts)은 canTransition으로 printed/received/error에서만 허용하지만,
// 데모 중에는 이미 확정된 문서에도 몇 번이고 다시 돌려볼 수 있어야 한다는 요청으로
// 별도 엔드포인트를 뒀다. NEXT_PUBLIC_DEMO_MODE가 꺼져 있으면(정식 배포) 항상 403 —
// 확정된 문서가 상태 전이 규칙 없이 덮어써지는 걸 막는 안전장치다.
export async function POST(_req: Request, ctx: RouteContext<"/api/documents/[documentId]/demo-reprocess">) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return Response.json({ error: "DEMO_MODE_DISABLED" }, { status: 403 });
  }

  const { documentId } = await ctx.params;
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const result = await runOcrPipeline(documentId);
  if (!result.ok) {
    return Response.json({ error: result.error, message: result.message }, { status: result.status });
  }
  const updated = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  return Response.json(updated);
}
