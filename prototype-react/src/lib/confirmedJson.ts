import type { DocumentRecord } from '../types'
import { itsuwaInspectionGroup } from '../data/itsuwaGroupDef'

// 확정된 구조화 JSON을 만드는 단일 지점 — PRD §7.9 "하나의 확정 JSON이 CSV·Excel의 유일한 원천".
// D단계에서 Kotobuki(비반복 필드) 매핑까지 더해 완성하고, JSON 화면·CSV·Excel이 전부 이 함수 하나만 소비하게 한다.
export function buildConfirmedJson(doc: DocumentRecord): Record<string, unknown> {
  return {
    documentId: doc.id,
    formId: doc.formId,
    formName: doc.formName,
    owner: doc.owner,
    updatedAt: doc.updatedAt,
    [itsuwaInspectionGroup.dataKey]: doc.rows.map((row) => {
      const record: Record<string, string> = { lot_no: row.lot }
      for (const column of itsuwaInspectionGroup.columns) {
        record[column.id] = row[column.id] ?? ''
      }
      return record
    }),
  }
}
