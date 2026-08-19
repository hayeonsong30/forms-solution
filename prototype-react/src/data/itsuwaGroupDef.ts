import type { RepeatingGroupDefinition } from '../types'
import { itsuwaGroupHint } from './itsuwaGroupHints'

// Documents.tsx(뷰어)가 쓰는 열 구조 참조 — 좌표가 필요 없는 컬럼 목록만 필요하므로
// 편집기가 쓰는 itsuwaGroupHint(% 좌표 포함)에서 컬럼 정의를 그대로 가져와 중복을 없앤다.
export const itsuwaInspectionGroup: RepeatingGroupDefinition = {
  id: itsuwaGroupHint.id,
  label: itsuwaGroupHint.label,
  dataKey: itsuwaGroupHint.id,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  rowHeight: 0,
  maxRows: itsuwaGroupHint.maxRows,
  excludeHeaderRow: itsuwaGroupHint.excludeHeaderRow,
  source: 'ai',
  columns: itsuwaGroupHint.columns,
}
