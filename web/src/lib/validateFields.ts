// PRD_양식편집기_상세 §13 검사 규칙 중 1차 데모 필드 범위(텍스트/숫자/체크)에 해당하는 항목만 구현.
// 반복행 관련 검사(열이 그룹 밖, 행 높이 0 등)는 Phase 2에서 추가.

type FieldLike = {
  id: string;
  pageNo: number;
  dataKey: string;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
};

export type FieldIssue = {
  code: "overlap" | "duplicate_key";
  fieldIds: string[];
  message: string;
};

function boxesOverlap(a: FieldLike, b: FieldLike): boolean {
  return a.boxX < b.boxX + b.boxW && a.boxX + a.boxW > b.boxX && a.boxY < b.boxY + b.boxH && a.boxY + a.boxH > b.boxY;
}

export function validateFields(fields: FieldLike[]): FieldIssue[] {
  const issues: FieldIssue[] = [];

  const byKey = new Map<string, string[]>();
  for (const f of fields) {
    const list = byKey.get(f.dataKey) ?? [];
    list.push(f.id);
    byKey.set(f.dataKey, list);
  }
  for (const [dataKey, ids] of byKey) {
    if (ids.length > 1) {
      issues.push({ code: "duplicate_key", fieldIds: ids, message: `데이터 키 중복: ${dataKey}` });
    }
  }

  const byPage = new Map<number, FieldLike[]>();
  for (const f of fields) {
    const list = byPage.get(f.pageNo) ?? [];
    list.push(f);
    byPage.set(f.pageNo, list);
  }
  for (const pageFields of byPage.values()) {
    for (let i = 0; i < pageFields.length; i += 1) {
      for (let j = i + 1; j < pageFields.length; j += 1) {
        if (boxesOverlap(pageFields[i], pageFields[j])) {
          issues.push({
            code: "overlap",
            fieldIds: [pageFields[i].id, pageFields[j].id],
            message: `필드 영역 겹침: ${pageFields[i].dataKey} / ${pageFields[j].dataKey}`,
          });
        }
      }
    }
  }

  return issues;
}
