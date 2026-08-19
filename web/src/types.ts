export type FieldType = "text" | "number" | "check" | "date" | "time" | "choice";

export type TextConfig = {
  writingMode: "single" | "multiline";
  language: "ja" | "ko" | "en" | "auto";
  charPolicy: "all" | "numeric_included" | "alnum" | "custom_pattern";
  customPattern?: string;
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
  ambiguousPolicy: "always_review" | "nearest_guess";
  regionMode: "box" | "full_area";
  exclusiveWithFieldId?: string;
};

export type DateConfig = {
  format: string;
  allowBlank: boolean;
};

export type TimeConfig = {
  format: string;
  allowBlank: boolean;
};

export type ChoiceConfig = {
  mode: "single" | "multiple";
  options: string[];
};

export type FieldConfig = {
  text?: TextConfig;
  number?: NumberConfig;
  check?: CheckConfig;
  date?: DateConfig;
  time?: TimeConfig;
  choice?: ChoiceConfig;
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
};

export type TemplateDTO = {
  id: string;
  orgId: string;
  name: string;
  status: "draft" | "active" | "retired";
  printable: boolean;
  printableReason: string | null;
  currentVersionId: string | null;
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
};

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
  confirmedAt: string | null;
};

export type DocumentListItemDTO = DocumentDTO & {
  templateVersion: { pageCount: number; template: { name: string } };
  needsReviewCount: number;
  repeatRowCount: number;
};

export type FieldValueDTO = {
  id: string;
  documentId: string;
  fieldId: string | null;
  field: { id: string; label: string; dataKey: string; required: boolean; type: FieldType; config: FieldConfig } | null;
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
  templateVersion: { template: { name: string } };
  fieldValues: FieldValueDTO[];
  pageImageCount: number;
};

export type FieldIssue = {
  code: "overlap" | "duplicate_key";
  fieldIds: string[];
  message: string;
};
