import { listPlaceholders } from "@/lib/excelPlaceholders";

// PRD_Excel_플레이스홀더_간단버전 §6, §13. ?type=list면 반복행 [데이터키.NN] 슬롯도 함께 준다.
export async function GET(req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-placeholders">) {
  const { versionId } = await ctx.params;
  const includeRepeat = new URL(req.url).searchParams.get("type") === "list";
  const placeholders = await listPlaceholders(versionId, { includeRepeat });
  return Response.json({ placeholders });
}
