import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { exportRequestSchema } from "@/lib/schemas";
import { collectRows, NotConfirmedError } from "@/lib/exportDocuments";
import { rowsToCsv } from "@/lib/csv";

// PRD_폼솔루션 §7.9.2: 단건 CSV(문서 1건=1행 또는 반복행 평탄화) / 다건 CSV(선택 문서 병합).
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "VALIDATION_FAILED", issues: parsed.error.issues }, { status: 400 });
  }

  let rows;
  try {
    rows = await collectRows(parsed.data.documentIds);
  } catch (e) {
    if (e instanceof NotConfirmedError) {
      return Response.json({ error: "NOT_CONFIRMED", documentIds: e.documentIds }, { status: 409 });
    }
    throw e;
  }

  const csv = rowsToCsv(rows);
  const exportType = parsed.data.documentIds.length > 1 ? "csv_batch" : "csv_single";

  await prisma.export.create({
    data: {
      documentId: parsed.data.documentIds.length === 1 ? parsed.data.documentIds[0] : null,
      batch: parsed.data.documentIds.length > 1 ? (parsed.data.documentIds as Prisma.InputJsonValue) : undefined,
      exportType,
    },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${Date.now()}.csv"`,
    },
  });
}
