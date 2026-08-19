// PRD_폼솔루션 §7.9.1: 확정 JSON 하나를 원천으로 CSV/Excel을 만든다. 기본 출력은 확정값
// (finalValue)을 사용한다. 일반 필드는 문서 루트 속성, 반복행은 배열.
import { prisma } from "@/lib/prisma";

export type ConfirmedDocumentJson = {
  documentId: string;
  ncode: string | null;
  templateName: string;
  confirmedAt: string | null;
  fields: Record<string, string | null>;
  repeats: Record<string, Array<Record<string, string | null>>>;
};

export async function buildConfirmedJson(documentId: string): Promise<ConfirmedDocumentJson | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      templateVersion: { include: { template: { select: { name: true } } } },
      fieldValues: { include: { field: true, repeatColumn: { include: { repeatGroup: true } } } },
    },
  });
  if (!document) return null;

  const fields: Record<string, string | null> = {};
  const repeats: Record<string, Array<Record<string, string | null>>> = {};

  for (const v of document.fieldValues) {
    if (v.field) {
      fields[v.field.dataKey] = v.finalValue;
    } else if (v.repeatColumn && v.rowIndex !== null) {
      const groupKey = v.repeatColumn.repeatGroup.dataKey;
      const rows = (repeats[groupKey] ??= []);
      while (rows.length <= v.rowIndex) rows.push({});
      rows[v.rowIndex][v.repeatColumn.dataKey] = v.finalValue;
    }
  }

  return {
    documentId: document.id,
    ncode: document.ncode,
    templateName: document.templateVersion.template.name,
    confirmedAt: document.confirmedAt?.toISOString() ?? null,
    fields,
    repeats,
  };
}

// PRD §7.9.2: CSV는 반복행 1개=1행으로 평탄화하고, 문서 기본정보(일반 필드)는 각 행에 반복한다.
// 반복행이 없으면 문서당 1행.
export function flattenToRows(doc: ConfirmedDocumentJson): Array<Record<string, string | null>> {
  const groupKeys = Object.keys(doc.repeats);
  if (groupKeys.length === 0) {
    return [{ ...doc.fields }];
  }

  const maxRows = Math.max(...groupKeys.map((k) => doc.repeats[k].length));
  const rows: Array<Record<string, string | null>> = [];
  for (let i = 0; i < maxRows; i += 1) {
    const row: Record<string, string | null> = { ...doc.fields };
    for (const groupKey of groupKeys) {
      const rowData = doc.repeats[groupKey][i] ?? {};
      for (const [colKey, value] of Object.entries(rowData)) {
        row[`${groupKey}.${colKey}`] = value;
      }
    }
    rows.push(row);
  }
  return rows;
}
