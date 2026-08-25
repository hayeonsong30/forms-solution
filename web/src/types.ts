export type FieldType = "text" | "number" | "check" | "date" | "time" | "choice";

export type TextConfig = {
  writingMode: "single" | "multiline";
  language: "ja" | "ko" | "en" | "auto";
  charPolicy: "all" | "numeric_included" | "alnum";
  maxLength?: number;
  preserveWhitespace: boolean;
  preserveNewline: boolean;
};

export type NumberConfig = {
  numberFormat: "integer" | "decimal";
  allowNegative: boolean;
  decimalPlaces: number;
  min?: number;
  max?: number;
  unit?: string;
  thousandsSeparator: boolean;
  allowBlank: boolean;
};

export type CheckConfig = {
  mode: "presence" | "symbol_classification";
  trueMarks: string[];
  falseMarks: string[];
  blankValue: "false" | "null" | "required_error";
  // "boolean": 무슨 기호를 썼든 true/false로 정규화(기존 방식).
  // "symbol": 실제로 손으로 쓴 기호(V·O·X·✓ 등)를 그대로 값으로 남긴다.
  outputMode: "boolean" | "symbol";
};

export type DateConfig = {
  inputFormat: "auto" | "YYYY/MM/DD" | "YYYY-MM-DD" | "YYYY년 MM월 DD일" | "MM/DD";
  outputFormat: "YYYY-MM-DD" | "source";
};

export type TimeConfig = {
  inputMode: "auto" | "24h" | "12h" | "split_hour_minute";
  outputFormat: "HH:mm" | "source";
};

export type ChoiceConfig = {
  mode: "single" | "multiple";
  conflictPolicy: "review_required" | "last_marked" | "first_marked";
  csvPolicy: "delimiter" | "one_column_per_option";
};

export type FieldConfig = {
  text?: TextConfig;
  number?: NumberConfig;
  check?: CheckConfig;
  date?: DateConfig;
  time?: TimeConfig;
  choice?: ChoiceConfig;
};

export type ChoiceOptionDTO = {
  id: string;
  fieldId: string | null;
  repeatColumnId: string | null;
  orderNo: number;
  label: string;
  storedValue: string;
  regionX: number | null;
  regionY: number | null;
  regionW: number | null;
  regionH: number | null;
};

export type FieldDTO = {
  id: string;
  templateVersionId: string;
  pageNo: number;
  label: string;
  description: string | null;
  dataKey: string;
  type: FieldType;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  required: boolean;
  locked: boolean;
  hidden: boolean;
  source: "manual" | "ai" | "copied";
  status: "suggested" | "confirmed";
  config: FieldConfig;
  choiceOptions: ChoiceOptionDTO[];
};

export type TemplateDTO = {
  id: string;
  orgId: string;
  name: string;
  status: "draft" | "printable";
  printableReason: string | null;
  currentVersionId: string | null;
  printCopies: number;
  printedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TemplateListItemDTO = TemplateDTO & {
  org: { name: string };
  pageCount: number;
  fieldCount: number;
};

export type TemplateVersionDTO = {
  id: string;
  templateId: string;
  versionNo: number;
  pageCount: number;
  hasPdf: boolean;
};

export type RepeatColumnDTO = {
  id: string;
  repeatGroupId: string;
  orderNo: number;
  label: string;
  dataKey: string;
  type: FieldType;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  required: boolean;
  config: FieldConfig;
  choiceOptions: ChoiceOptionDTO[];
};

export type FixedRowValue = { rowIndex: number; values: Record<string, string> };

export type RepeatGroupDTO = {
  id: string;
  templateVersionId: string;
  label: string;
  dataKey: string;
  pageNo: number;
  areaX: number;
  areaY: number;
  areaW: number;
  areaH: number;
  rowHeight: number;
  maxRows: number;
  blankRowPolicy: "exclude" | "include";
  useRowNumber: boolean;
  allowDuplicate: boolean;
  fixedRows: FixedRowValue[] | null;
  columns: RepeatColumnDTO[];
};

export type TemplateDetailResponse = {
  template: TemplateDTO;
  version: TemplateVersionDTO;
  fields: FieldDTO[];
  repeatGroups: RepeatGroupDTO[];
};

export type DocumentStatus = "printed" | "received" | "processing" | "review_required" | "confirmed" | "error";

export type DocumentDTO = {
  id: string;
  templateVersionId: string;
  orgId: string;
  ncode: string | null;
  status: DocumentStatus;
  createdAt: string;
  receivedAt: string | null;
  confirmedAt: string | null;
};

export type DocumentListItemDTO = DocumentDTO & {
  templateVersion: { pageCount: number; template: { id: string; name: string } };
  org: { name: string };
  needsReviewCount: number;
  repeatRowCount: number;
  // 동일 SOBP(ncode)로 여러 건이 들어온 경우(예: 고토부키형 공유 SOBP) 목록에서는 1건으로
  // 묶어 보여준다 — pageScanCount는 그 그룹에 실제로 들어온 스캔(페이지) 수, groupIds는
  // 그룹에 속한 모든 문서 id(가상번호 순서 = createdAt 오름차순). 일반 문서는 항상
  // pageScanCount=1, groupIds=[해당 문서 id 하나].
  pageScanCount: number;
  groupIds: string[];
};

export type FieldValueDTO = {
  id: string;
  documentId: string;
  fieldId: string | null;
  field:
    | {
        id: string;
        label: string;
        dataKey: string;
        required: boolean;
        type: FieldType;
        config: FieldConfig;
        choiceOptions: ChoiceOptionDTO[];
        pageNo: number;
        boxX: number;
        boxY: number;
        boxW: number;
        boxH: number;
      }
    | null;
  repeatGroupId: string | null;
  repeatColumnId: string | null;
  repeatColumn:
    | { id: string; label: string; dataKey: string; required: boolean; type: FieldType; config: FieldConfig }
    | null;
  rowIndex: number | null;
  rawOcrValue: string | null;
  normalizedValue: string | null;
  finalValue: string | null;
  valueSource: "ai" | "user" | "stroke_rule" | "empty_rule" | null;
  reviewStatus: "pending" | "needs_review" | "confirmed";
  reviewReasons: string[];
};

export type DocumentDetailDTO = DocumentDTO & {
  templateVersion: { pageCount: number; template: { id: string; name: string }; fields: FieldDTO[] };
  fieldValues: FieldValueDTO[];
  pageImageCount: number;
  // 페이지마다 새 SOBP가 발급되는 게 원칙이라(§14 항목1) 페이지별 패턴주소를 담는다.
  // index 0 = 1페이지. 아직 실 펜 SDK 연동 전이라 문서 생성 시 임시로 채워진다.
  pageNcodes: string[];
  // 공유 SOBP로 이 문서와 같은 ncode를 쓰는 다른 문서들(2건 이상일 때만 채워짐, 자기 자신
  // 포함, createdAt 오름차순 = 가상번호 순서). PRD_폼솔루션 §14.1.
  siblings: { id: string; ncode: string | null; createdAt: string; status: DocumentStatus }[];
};

export type FieldIssue = {
  code: "overlap" | "duplicate_key";
  fieldIds: string[];
  message: string;
};
