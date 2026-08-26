import { validateExcelTemplateSchema } from "@/lib/schemas";
import { parseDataUri } from "@/lib/dataUri";
import { listPlaceholders } from "@/lib/excelPlaceholders";
import { inspectExcelTemplate } from "@/lib/excelTemplateEngine";

// PRD_Excel_플레이스홀더_간단버전 §9: 저장 없이 검사만 먼저 해볼 수 있게 한다.
export async function POST(req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-template/validate">) {
  const { versionId } = await ctx.params;
  const body = await req.json();
  const parsed = validateExcelTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }
  if (!parsed.data.fileName.toLowerCase().endsWith(".xlsx")) {
    return Response.json({ error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
  }
  const parsedUri = parseDataUri(parsed.data.fileDataUri);
  if (!parsedUri) {
    return Response.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }
  const buffer = Buffer.from(parsedUri.data, "base64");
  if (buffer.byteLength > 10 * 1024 * 1024) {
    return Response.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const placeholders = await listPlaceholders(versionId);
  let result;
  try {
    result = await inspectExcelTemplate(buffer, placeholders.map((p) => p.dataKey));
  } catch {
    return Response.json({ error: "WORKBOOK_CORRUPTED" }, { status: 400 });
  }

  return Response.json(result);
}
