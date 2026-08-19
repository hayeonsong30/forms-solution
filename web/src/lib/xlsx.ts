// PRD_폼솔루션 §7.9.3: 헤더 강조, 열 너비, 필터, 첫 행 고정을 기본 적용한 .xlsx.
// 1차 데모는 `Data` 시트 1개.
import ExcelJS from "exceljs";

export async function rowsToXlsxBuffer(rows: Array<Record<string, string | null>>): Promise<Buffer> {
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = columns.map((c) => ({ header: c, key: c, width: Math.min(Math.max(c.length + 4, 12), 40) }));
  rows.forEach((row) => sheet.addRow(row));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  if (rows.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
