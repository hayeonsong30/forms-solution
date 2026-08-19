export type FieldType = "text" | "number" | "check";

export type FieldDTO = {
  id: string;
  templateVersionId: string;
  pageNo: number;
  label: string;
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
  config: Record<string, unknown>;
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
