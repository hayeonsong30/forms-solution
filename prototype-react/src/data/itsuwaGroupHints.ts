import type { RepeatingColumn } from '../types'

// ITSUWA 入庫品質検査表(입고 품질검사표) 반복행 — 미리 검증해 둔 "학습된" AI 인식 결과.
// kotobukiFieldHints.ts와 동일하게 페이지 대비 % 좌표로 저장하고, 캔버스 렌더링 시 px로 변환한다.
// 각 열의 widthPct는 실제 PDF 표의 열 너비 비율을 반영해, 편집기 캔버스에 실제 셀 경계로 겹쳐 그린다.
export interface RepeatingGroupHint {
  id: string
  label: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
  maxRows: number
  rowLabelWidthPct: number
  excludeHeaderRow?: boolean
  columns: RepeatingColumn[]
}

export const itsuwaGroupHint: RepeatingGroupHint = {
  id: 'inspection_rows',
  label: '検査記録 (Lot 01–25)',
  xPct: 3,
  yPct: 3,
  wPct: 94,
  hPct: 94,
  maxRows: 25,
  rowLabelWidthPct: 9,
  excludeHeaderRow: true,
  columns: [
    { id: 'time', label: '時間', type: 'time', excelColumn: 'time', widthPct: 15 },
    { id: 'packaging', label: '包装形態', type: 'shorttext', excelColumn: 'packaging', widthPct: 21 },
    { id: 'inspector', label: '点検者', type: 'shorttext', excelColumn: 'inspector', widthPct: 17 },
    { id: 'visual', label: '異物目視', type: 'checkbox', excelColumn: 'visual', widthPct: 7 },
    { id: 'stain', label: '汚れ破れ', type: 'checkbox', excelColumn: 'stain', widthPct: 7 },
    { id: 'appearance', label: '荷姿', type: 'checkbox', excelColumn: 'appearance', widthPct: 7 },
    { id: 'ijp', label: 'IJP', type: 'checkbox', excelColumn: 'ijp', widthPct: 6 },
    { id: 'print', label: '印字', type: 'checkbox', excelColumn: 'print', widthPct: 6 },
    { id: 'card', label: 'カード', type: 'checkbox', excelColumn: 'card', widthPct: 5 },
  ],
}
