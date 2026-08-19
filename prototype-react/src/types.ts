export type FieldType =
  | 'calculation'
  | 'checkbox'
  | 'date'
  | 'number'
  | 'dropdown'
  | 'multiple-choice'
  | 'photo'
  | 'longtext'
  | 'single-choice'
  | 'rating'
  | 'signature'
  | 'statictext'
  | 'shorttext'
  | 'time'

// 라디오·체크박스 옵션 하나의 실제 캔버스 좌표 — PRD §7.7.3 "체크·라디오는 펜 획 좌표
// 규칙을 우선한다"를 만족하려면 옵션 전체를 감싸는 큰 박스 하나가 아니라 옵션마다
// 개별 사각형 좌표가 있어야 펜 획 존재 여부를 옵션 단위로 판정할 수 있다.
export interface OptionRegion {
  option: string
  x: number
  y: number
  w: number
  h: number
}

export interface DetectedField {
  id: string
  label: string
  type: FieldType
  variant?: string
  excelColumn: string
  options?: string[]
  // single-choice/multiple-choice에서만 사용 — 옵션별 실제 체크박스 좌표.
  // 없으면(레거시 또는 아직 세분화 전) 필드 전체 박스 하나로 표시된다.
  optionRegions?: OptionRegion[]
  confirmed: boolean
  required?: boolean
  readOnly?: boolean
  hideOnPdf?: boolean
  background?: string
  default?: string
  format?: string
  systemDefault?: string
  source: 'ai' | 'manual'
  // 렌더링된 캔버스 기준 실좌표 (px) — optionRegions가 있으면 이 사각형은
  // 옵션들을 모두 포함하는 참고용 바운딩 박스로만 쓰인다.
  x: number
  y: number
  w: number
  h: number
}

// 반복행 그룹의 열 하나 — PDF 좌표는 갖지 않고 그룹 영역 안에서의 순서·타입만 정의
export interface RepeatingColumn {
  id: string
  label: string
  type: FieldType
  excelColumn: string
  options?: string[]
  // 그룹 너비 대비 % — 캔버스에 실제 셀 경계를 그리는 데 사용. 없으면 균등 분할.
  widthPct?: number
}

// 반복행 그룹 정의 — PRD §7.2/§7.3. 그룹 영역을 한 번 정의하면
// 실행 시 inspection_rows[0], inspection_rows[1]... 형태로 저장된다.
export interface RepeatingGroupDefinition {
  // 내부 식별자 — 변경되지 않는 값, 화면에서 편집 불가(DetectedField.id와 동일한 역할)
  id: string
  label: string
  // 내보내기용 배열명(JSON의 최상위 키) — 사용자가 편집 가능. DetectedField.excelColumn과 동일한 역할.
  dataKey: string
  x: number
  y: number
  w: number
  h: number
  columns: RepeatingColumn[]
  rowHeight: number
  maxRows: number
  // 왼쪽에 인쇄된 행 번호(Lot No. 등) 영역의 너비(그룹 너비 대비 %) — 편집 불가한 시각용 여백
  rowLabelWidthPct?: number
  excludeHeaderRow?: boolean
  source: 'ai' | 'manual'
}

export interface DocumentRecord {
  id: string
  formId: string
  formName: string
  owner: string
  status: 'Print' | 'Write' | 'Complete'
  updatedAt: string
  deviceId: string
  // 반복행 그룹의 실제 작성 데이터 — 열 id를 키로 갖는 범용 레코드.
  // 일반(비반복) 필드값은 아직 이 스키마에 없음 — C단계에서 FieldValue[]로 확장 예정.
  rows: Record<string, string>[]
}

// C단계(업로드→OCR 검수 화면)와 D단계(확정 JSON)가 공유할 필드값 모델.
// 지금은 타입만 확정해두고, 실제 채움은 해당 단계에서 진행한다.
export interface FieldValue {
  key: string
  label: string
  ocrValue: string
  finalValue: string
  confidence: number
  verified: boolean
}

// AI OCR 제공자 교체 인터페이스 — PRD §7.7.5.
// C단계 화면은 이 인터페이스만 보고 짜고, E단계에서 구현체만 Gemini로 교체한다.
export interface OcrFieldInput {
  fieldImage: string
  key: string
  label: string
  type: FieldType
}

export interface OcrResult {
  value: string
  confidence: number
}

export interface OcrProvider {
  recognize(input: OcrFieldInput): Promise<OcrResult>
}

export type Role = 'admin' | 'field'
