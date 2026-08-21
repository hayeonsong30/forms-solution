import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { excelTemplateTypeSchema, saveExcelTemplateSchema } from "@/lib/schemas";
import { parseDataUri } from "@/lib/dataUri";
import { listPlaceholders } from "@/lib/excelPlaceholders";
import { inspectExcelTemplate } from "@/lib/excelTemplateEngine";

// PRD_Excel_플레이스홀더_간단버전 §11: 양식 버전당 doc/list 타입 각각 활성 템플릿 1개.
export async function GET(req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-template">) {
  const { versionId } = await ctx.params;
  const type = excelTemplateTypeSchema.safeParse(new URL(req.url).searchParams.get("type"));
  if (!type.success) return Response.json({ error: "VALIDATION_FAILED" }, { status: 400 });

  const template = await prisma.excelReportTemplate.findUnique({
    where: { templateVersionId_type: { templateVersionId: versionId, type: type.data } },
  });
  if (!template) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const { fileData: _fileData, ...meta } = template;
  return Response.json(meta);
}

export async function POST(req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-template">) {
  const { versionId } = await ctx.params;
  const body = await req.json();
  const parsed = saveExcelTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }
  if (!parsed.data.fileName.toLowerCase().endsWith(".xlsx")) {
    return Response.json({ error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
  }
  const parsedUri = parseDataUri(parsed.data.fileDataUri);
  if (!parsedUri) return Response.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  const buffer = Buffer.from(parsedUri.data, "base64");
  if (buffer.byteLength > 10 * 1024 * 1024) {
    return Response.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const placeholders = await listPlaceholders(versionId, { includeRepeat: parsed.data.type === "list" });
  let validationResult;
  try {
    validationResult = await inspectExcelTemplate(buffer, placeholders.map((p) => p.dataKey));
  } catch {
    return Response.json({ error: "WORKBOOK_CORRUPTED" }, { status: 400 });
  }
  // §9: 오류가 있는 템플릿은 활성화(저장)할 수 없다.
  if (validationResult.status === "invalid") {
    return Response.json({ error: "VALIDATION_FAILED", validationResult }, { status: 400 });
  }

  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const saved = await prisma.excelReportTemplate.upsert({
    where: { templateVersionId_type: { templateVersionId: versionId, type: parsed.data.type } },
    create: {
      templateVersionId: versionId,
      type: parsed.data.type,
      name: parsed.data.name,
      fileName: parsed.data.fileName,
      fileData: parsedUri.data,
      checksum,
      status: "active",
      placeholderCount: validationResult.validPlaceholders.length,
      validationResult: validationResult as unknown as Prisma.InputJsonValue,
    },
    update: {
      name: parsed.data.name,
      fileName: parsed.data.fileName,
      fileData: parsedUri.data,
      checksum,
      status: "active",
      placeholderCount: validationResult.validPlaceholders.length,
      validationResult: validationResult as unknown as Prisma.InputJsonValue,
    },
  });
  const { fileData: _fileData, ...meta } = saved;
  return Response.json(meta, { status: 201 });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/template-versions/[versionId]/excel-template">) {
  const { versionId } = await ctx.params;
  const type = excelTemplateTypeSchema.safeParse(new URL(req.url).searchParams.get("type"));
  if (!type.success) return Response.json({ error: "VALIDATION_FAILED" }, { status: 400 });

  await prisma.excelReportTemplate.deleteMany({ where: { templateVersionId: versionId, type: type.data } });
  return new Response(null, { status: 204 });
}
