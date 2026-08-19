import type { DocumentRecord } from '../types'

// ITSUWA-1_PageNum_1_docSeq-13048 — 실제 필기 데이터가 있는 샘플 문서 (Lot 01~03만 기입됨)
export const itsuwaFilledRows: Record<string, string>[] = [
  { lot: '01', time: '9:00', packaging: '通常', inspector: 'カトウ', visual: '✓', stain: '✓', appearance: '✓', ijp: '✓', print: '—', card: '✓' },
  { lot: '02', time: '12:00', packaging: '通常', inspector: 'カマ', visual: '○', stain: '○', appearance: '×', ijp: '×', print: '○', card: '○' },
  { lot: '03', time: '15:00', packaging: '—', inspector: 'ガトウ', visual: '✓', stain: '×', appearance: '×', ijp: '✓', print: '✓', card: '✓' },
]

export const itsuwaEmptyLots = Array.from({ length: 22 }, (_, i) => String(i + 4).padStart(2, '0'))

export const documents: DocumentRecord[] = [
  {
    id: '13048',
    formId: 'ITSUWA-1',
    formName: '包装検査記録表',
    owner: '네오랩',
    status: 'Write',
    updatedAt: '2026-08-10 14:11',
    deviceId: '9C:7B:D2:57:20:1B',
    rows: itsuwaFilledRows,
  },
  {
    id: '13049',
    formId: 'ITSUWA-1',
    formName: '包装検査記録表',
    owner: '田中 太郎',
    status: 'Complete',
    updatedAt: '2026-07-23 13:53',
    deviceId: '9C:7B:D2:57:1F:D3',
    rows: [
      { lot: '01', time: '8:30', packaging: '通常', inspector: 'サトウ', visual: '✓', stain: '✓', appearance: '✓', ijp: '✓', print: '✓', card: '✓' },
    ],
  },
  {
    id: '13041',
    formId: 'YAMATO_GIFT-1',
    formName: '注文書',
    owner: '네오랩',
    status: 'Print',
    updatedAt: '2026-07-23 10:06',
    deviceId: '9C:7B:D2:57:1F:E1',
    rows: [],
  },
]
