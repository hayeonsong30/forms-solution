import { prisma } from "@/lib/prisma";
import { buildConfirmedJson, flattenToRows } from "@/lib/confirmedJson";

export class NotConfirmedError extends Error {
  constructor(public documentIds: string[]) {
    super("일부 문서가 아직 확정되지 않았습니다.");
  }
}

// PRD §7.9: 추출(CSV/Excel)은 확정된 문서만 대상으로 한다.
export async function collectRows(documentIds: string[]): Promise<Array<Record<string, string | null>>> {
  const statuses = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, status: true },
  });
  const foundIds = new Set(statuses.map((d) => d.id));
  const missing = documentIds.filter((id) => !foundIds.has(id));
  const notConfirmed = [...missing, ...statuses.filter((d) => d.status !== "confirmed").map((d) => d.id)];
  if (notConfirmed.length > 0) throw new NotConfirmedError(notConfirmed);

  const rows: Array<Record<string, string | null>> = [];
  for (const id of documentIds) {
    const json = await buildConfirmedJson(id);
    if (json) rows.push(...flattenToRows(json));
  }
  return rows;
}
