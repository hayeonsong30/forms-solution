// PRD_양식편집기_상세 §13 검사 규칙 중 1차 데모 필드 범위(텍스트/숫자/체크/반복행)에 해당하는 항목만 구현.

type Box = { boxX: number; boxY: number; boxW: number; boxH: number };

type FieldLike = Box & {
  id: string;
  pageNo: number;
  dataKey: string;
};

type RepeatGroupLike = Box & {
  id: string;
  pageNo: number;
  dataKey: string;
  rowHeight: number;
  maxRows: number;
};

export type FieldIssue = {
  code: "overlap" | "duplicate_key" | "invalid_row_height" | "invalid_max_rows";
  fieldIds: string[];
  message: string;
};

function boxesOverlap(a: Box, b: Box): boolean {
  return a.boxX < b.boxX + b.boxW && a.boxX + a.boxW > b.boxX && a.boxY < b.boxY + b.boxH && a.boxY + a.boxH > b.boxY;
}

export function validateFields(fields: FieldLike[], repeatGroups: RepeatGroupLike[] = []): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const items = [
    ...fields.map((f) => ({ id: f.id, dataKey: f.dataKey, pageNo: f.pageNo, boxX: f.boxX, boxY: f.boxY, boxW: f.boxW, boxH: f.boxH })),
    ...repeatGroups.map((g) => ({ id: g.id, dataKey: g.dataKey, pageNo: g.pageNo, boxX: g.boxX, boxY: g.boxY, boxW: g.boxW, boxH: g.boxH })),
  ];

  const byKey = new Map<string, string[]>();
  for (const it of items) {
    const list = byKey.get(it.dataKey) ?? [];
    list.push(it.id);
    byKey.set(it.dataKey, list);
  }
  for (const [dataKey, ids] of byKey) {
    if (ids.length > 1) {
      issues.push({ code: "duplicate_key", fieldIds: ids, message: `데이터 키 중복: ${dataKey}` });
    }
  }

  for (const g of repeatGroups) {
    if (g.rowHeight <= 0) {
      issues.push({ code: "invalid_row_height", fieldIds: [g.id], message: `반복행 "${g.dataKey}"의 행 높이가 0 이하입니다.` });
    }
    if (g.maxRows <= 0) {
      issues.push({ code: "invalid_max_rows", fieldIds: [g.id], message: `반복행 "${g.dataKey}"의 최대 행 수가 0 이하입니다.` });
    }
  }

  const byPage = new Map<number, typeof items>();
  for (const it of items) {
    const list = byPage.get(it.pageNo) ?? [];
    list.push(it);
    byPage.set(it.pageNo, list);
  }
  for (const pageItems of byPage.values()) {
    for (let i = 0; i < pageItems.length; i += 1) {
      for (let j = i + 1; j < pageItems.length; j += 1) {
        if (boxesOverlap(pageItems[i], pageItems[j])) {
          issues.push({
            code: "overlap",
            fieldIds: [pageItems[i].id, pageItems[j].id],
            message: `영역 겹침: ${pageItems[i].dataKey} / ${pageItems[j].dataKey}`,
          });
        }
      }
    }
  }

  return issues;
}
