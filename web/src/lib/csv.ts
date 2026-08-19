// PRD_폼솔루션 §7.9.2: 열 이름은 데이터 키를 기본으로 자동 사용한다.
export function rowsToCsv(rows: Array<Record<string, string | null>>): string {
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((k) => set.add(k));
    return set;
  }, new Set<string>()));

  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const lines = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((c) => escape(row[c] ?? "")).join(",")),
  ];

  // UTF-8 BOM — Excel에서 한글/일본어가 깨지지 않도록.
  return "﻿" + lines.join("\r\n");
}
