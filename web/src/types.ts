export type FieldType = "text" | "number" | "check";

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

export type FieldConfig = {
  text?: TextConfig;
  number?: NumberConfig;
  check?: CheckConfig;
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
};

export type TemplateVersionDTO = {
  id: string;
  templateId: string;
  versionNo: number;
  pageCount: number;
};

export type TemplateDetailResponse = {
  template: TemplateDTO;
  version: TemplateVersionDTO;
  fields: FieldDTO[];
  repeatGroups: unknown[];
};

export type FieldIssue = {
  code: "overlap" | "duplicate_key";
  fieldIds: string[];
  message: string;
};
