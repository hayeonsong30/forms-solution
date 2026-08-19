import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { exportRequestSchema } from "@/lib/schemas";
import { collectRows, NotConfirmedError } from "@/lib/exportDocuments";
import { rowsToXlsxBuffer } from "@/lib/xlsx";

// PRD_폼솔루션 §7.9.3: 기본 Excel — 1건이면 Doc Excel, 다건이면 List Excel.
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

  const buffer = await rowsToXlsxBuffer(rows);
  const exportType = parsed.data.documentIds.length > 1 ? "excel_list" : "excel_doc";

  await prisma.export.create({
    data: {
      documentId: parsed.data.documentIds.length === 1 ? parsed.data.documentIds[0] : null,
      batch: parsed.data.documentIds.length > 1 ? (parsed.data.documentIds as Prisma.InputJsonValue) : undefined,
      exportType,
    },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="export-${Date.now()}.xlsx"`,
    },
  });
}
