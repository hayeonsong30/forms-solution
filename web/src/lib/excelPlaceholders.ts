// PRD_Excel_플레이스홀더_간단버전 §6, §8: 플레이스홀더로 노출 가능한 필드 목록과,
// 문서의 최종 확정값을 Excel 표시값(displayValue)으로 바꾸는 규칙.
import { prisma } from "@/lib/prisma";
import type { FieldConfig } from "@/types";
import type { FixedRowValue } from "@/lib/confirmedJson";

export type PlaceholderDefinition = { label: string; dataKey: string; type: string; system?: boolean };

// §6 시스템 필드: 서버가 허용한 키만 별도 구역으로 제공한다.
export const SYSTEM_PLACEHOLDERS: PlaceholderDefinition[] = [
  { label: "문서번호", dataKey: "document_no", type: "text", system: true },
  { label: "양식명", dataKey: "template_name", type: "text", system: true },
  { label: "인쇄일시", dataKey: "printed_at", type: "text", system: true },
  { label: "필기일시", dataKey: "written_at", type: "text", system: true },
  { label: "업로드일시", dataKey: "uploaded_at", type: "text", system: true },
  { label: "확정일시", dataKey: "confirmed_at", type: "text", system: true },
];

// choice로 병합된 필드는 이미 개별 체크 필드가 지워지고 그룹 필드 하나만 남아있으므로
// 별도 처리 없이 그대로 나열하면 된다(§6 "선택 그룹" 요구사항 자동 충족).
//
// includeRepeat(List Excel 전용, DigiDox 참고): 반복행은 동적으로 행을 복제하지 않고,
// 컬럼별로 [데이터키.01]~[데이터키.NN](행 번호 고정 슬롯) 형태의 플레이스홀더를 최대
// 행 수만큼 미리 나열한다. 반복 시작/종료 문법이 없어 Doc Excel과 같은 단순 셀 치환으로 처리된다.
export async function listPlaceholders(
  templateVersionId: string,
  opts: { includeRepeat?: boolean } = {}
): Promise<PlaceholderDefinition[]> {
  const fields = await prisma.field.findMany({
    where: { templateVersionId, hidden: false },
    orderBy: [{ boxY: "asc" }, { boxX: "asc" }],
    select: { label: true, dataKey: true, type: true },
  });
  const base: PlaceholderDefinition[] = [...fields, ...SYSTEM_PLACEHOLDERS];
  if (!opts.includeRepeat) return base;

  const groups = await prisma.repeatGroup.findMany({
    where: { templateVersionId },
    include: { columns: { orderBy: { orderNo: "asc" } } },
  });
  const repeatPlaceholders: PlaceholderDefinition[] = groups.flatMap((g) =>
    g.columns.flatMap((c) =>
      Array.from({ length: g.maxRows }, (_, i) => ({
        label: `${c.label} [${i + 1}행]`,
        dataKey: `${c.dataKey}.${String(i + 1).padStart(2, "0")}`,
        type: c.type,
      }))
    )
  );
  return [...base, ...repeatPlaceholders];
}

function formatDateTime(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

// §8 값 치환 규칙: 체크 true→✓/false→빈칸, choice는 표시명, 나머지는 finalValue 그대로.
export async function buildDocDisplayValues(documentId: string): Promise<Record<string, string>> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { templateVersion: { include: { template: { select: { name: true } } } } },
  });
  if (!document) throw new Error("DOCUMENT_NOT_FOUND");

  const values = await prisma.fieldValue.findMany({
    where: { documentId, fieldId: { not: null } },
    include: { field: { include: { choiceOptions: { orderBy: { orderNo: "asc" } } } } },
  });

  const result: Record<string, string> = {};
  for (const v of values) {
    const field = v.field;
    if (!field) continue;
    result[field.dataKey] = toDisplayValue(field.type, field.config as FieldConfig, v.finalValue, field.choiceOptions);
  }

  result.document_no = document.ncode ?? "";
  result.template_name = document.templateVersion.template.name;
  result.printed_at = formatDateTime(document.createdAt);
  result.written_at = formatDateTime(document.receivedAt);
  result.uploaded_at = formatDateTime(document.receivedAt);
  result.confirmed_at = formatDateTime(document.confirmedAt);

  // List Excel 전용: 반복행 컬럼 값을 [데이터키.행번호] 고정 슬롯 키로 채운다.
  const repeatValues = await prisma.fieldValue.findMany({
    where: { documentId, repeatColumnId: { not: null } },
    include: { repeatColumn: { include: { choiceOptions: { orderBy: { orderNo: "asc" } } } } },
  });
  for (const v of repeatValues) {
    const col = v.repeatColumn;
    if (!col || v.rowIndex === null) continue;
    const key = `${col.dataKey}.${String(v.rowIndex + 1).padStart(2, "0")}`;
    result[key] = toDisplayValue(col.type, col.config as FieldConfig, v.finalValue, col.choiceOptions);
  }
  // PDF에 이미 인쇄된 행별 고정값(No. 등)도 같은 슬롯 규칙으로 채운다 — 작성값이 이미 있으면 덮지 않는다.
  const groups = await prisma.repeatGroup.findMany({ where: { templateVersionId: document.templateVersionId } });
  for (const g of groups) {
    const fixedRows = (g.fixedRows as FixedRowValue[] | null) ?? [];
    for (const fr of fixedRows) {
      for (const [colKey, val] of Object.entries(fr.values)) {
        const key = `${colKey}.${String(fr.rowIndex + 1).padStart(2, "0")}`;
        if (!(key in result)) result[key] = val;
      }
    }
  }

  return result;
}

function toDisplayValue(
  type: string,
  config: FieldConfig,
  finalValue: string | null,
  choiceOptions: { storedValue: string; label: string }[]
): string {
  if (finalValue === null || finalValue === "") return "";
  if (type === "check") {
    // symbol 모드는 finalValue 자체가 이미 실제로 쓴 기호(V/O/X 등)라 그대로 내보낸다.
    if (config.check?.outputMode === "symbol") return finalValue;
    return finalValue === "true" ? "✓" : "";
  }
  if (type === "choice") {
    const byValue = new Map(choiceOptions.map((o) => [o.storedValue, o.label]));
    return finalValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => byValue.get(s) ?? s)
      .join(", ");
  }
  return finalValue;
}

// §10 샘플 생성: 실제 문서 없이 필드 유형별 테스트 값을 채운다. AI 호출 없음.
export function buildSampleValues(fields: PlaceholderDefinition[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of fields) {
    if (f.system) {
      result[f.dataKey] = { document_no: "SAMPLE-0001", template_name: "샘플 양식", printed_at: "2026-08-21 09:00" }[f.dataKey] ?? "2026-08-21 09:00";
      continue;
    }
    result[f.dataKey] =
      { text: "サンプル", number: "123", date: "2026-08-21", time: "09:30", check: "✓", choice: "샘플 옵션" }[f.type] ?? "샘플";
  }
  return result;
}
