import { listPlaceholders } from "@/lib/excelPlaceholders";

// PRD_Excel_플레이스홀더_간단버전 §6, §13. 반복행 [데이터키.NN] 슬롯도 항상 함께 준다.
export async function GET(_req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-placeholders">) {
  const { versionId } = await ctx.params;
  const placeholders = await listPlaceholders(versionId);
  return Response.json({ placeholders });
}
