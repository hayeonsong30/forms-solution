// PRD_폼솔루션 §7.9.1: 확정 JSON 하나를 원천으로 CSV/Excel을 만든다. 기본 출력은 확정값
// (finalValue)을 사용한다. 일반 필드는 문서 루트 속성, 반복행은 배열.
import { prisma } from "@/lib/prisma";
import type { ChoiceConfig, FieldConfig } from "@/types";

export type ConfirmedDocumentJson = {
  documentId: string;
  ncode: string | null;
  templateName: string;
  confirmedAt: string | null;
  fields: Record<string, string | null>;
  repeats: Record<string, Array<Record<string, string | null>>>;
  // 다중 선택 choice 필드의 CSV 방식 적용에 필요한 메타 (§14.1 csvPolicy).
  choiceMeta: Record<string, { csvPolicy: "delimiter" | "one_column_per_option" | "json_string"; options: string[] }>;
};

export async function buildConfirmedJson(documentId: string): Promise<ConfirmedDocumentJson | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      templateVersion: { include: { template: { select: { name: true } } } },
      fieldValues: {
        include: {
          field: { include: { choiceOptions: { orderBy: { orderNo: "asc" } } } },
          repeatColumn: { include: { repeatGroup: true } },
        },
      },
    },
  });
  if (!document) return null;

  const fields: Record<string, string | null> = {};
  const repeats: Record<string, Array<Record<string, string | null>>> = {};
  const choiceMeta: ConfirmedDocumentJson["choiceMeta"] = {};

  for (const v of document.fieldValues) {
    if (v.field) {
      fields[v.field.dataKey] = v.finalValue;
      const cfg = (v.field.config as FieldConfig).choice as ChoiceConfig | undefined;
      if (v.field.type === "choice" && cfg?.mode === "multiple") {
        choiceMeta[v.field.dataKey] = {
          csvPolicy: cfg.csvPolicy ?? "delimiter",
          options: v.field.choiceOptions.map((o) => o.storedValue),
        };
      }
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
    choiceMeta,
  };
}

// PRD §7.9.2: CSV는 반복행 1개=1행으로 평탄화하고, 문서 기본정보(일반 필드)는 각 행에 반복한다.
// 반복행이 없으면 문서당 1행.
export function flattenToRows(doc: ConfirmedDocumentJson): Array<Record<string, string | null>> {
  const baseFields = applyChoiceCsvPolicy(doc.fields, doc.choiceMeta);
  const groupKeys = Object.keys(doc.repeats);
  if (groupKeys.length === 0) {
    return [{ ...baseFields }];
  }

  const maxRows = Math.max(...groupKeys.map((k) => doc.repeats[k].length));
  const rows: Array<Record<string, string | null>> = [];
  for (let i = 0; i < maxRows; i += 1) {
    const row: Record<string, string | null> = { ...baseFields };
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

// PRD_양식편집기_상세 §14.1 csvPolicy: 다중 선택 값을 확정 CSV 열로 어떻게 펼칠지 결정한다.
// 저장 형식 자체(finalValue)는 항상 쉼표로 구분된 storedValue 문자열이므로, "delimiter"는
// 손댈 게 없고 나머지 두 방식만 실제로 변형한다.
function applyChoiceCsvPolicy(
  fields: Record<string, string | null>,
  choiceMeta: ConfirmedDocumentJson["choiceMeta"]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    const meta = choiceMeta[key];
    if (!meta || meta.csvPolicy === "delimiter") {
      result[key] = value;
      continue;
    }
    const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (meta.csvPolicy === "json_string") {
      result[key] = JSON.stringify(selected);
      continue;
    }
    // one_column_per_option: 옵션별로 열을 분리하고 각 열에 "true"/"false"를 담는다.
    for (const option of meta.options) {
      result[`${key}_${option}`] = String(selected.includes(option));
    }
  }
  return result;
}
