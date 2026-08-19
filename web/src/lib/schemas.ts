import { z } from "zod";

export const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
});

export const fieldTypeSchema = z.enum(["text", "number", "check"]);

// PRD_양식편집기_상세 §4.1
export const textConfigSchema = z.object({
  writingMode: z.enum(["single", "multiline"]).default("single"),
  language: z.enum(["ja", "ko", "en", "auto"]).default("ja"),
  charPolicy: z.enum(["all", "numeric_included", "alnum", "custom_pattern"]).default("all"),
  customPattern: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
  preserveWhitespace: z.boolean().default(false),
  preserveNewline: z.boolean().default(false),
});

// PRD_양식편집기_상세 §4.2
export const numberConfigSchema = z.object({
  numberFormat: z.enum(["integer", "decimal"]).default("integer"),
  allowNegative: z.boolean().default(false),
  decimalPlaces: z.number().int().min(0).max(6).default(0),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
  thousandsSeparator: z.boolean().default(false),
  allowBlank: z.boolean().default(true),
});

// PRD_양식편집기_상세 §4.3
export const checkConfigSchema = z.object({
  mode: z.enum(["presence", "symbol_classification"]).default("symbol_classification"),
  trueMarks: z.array(z.string()).default(["CHECK", "V"]),
  falseMarks: z.array(z.string()).default(["X"]),
  blankValue: z.enum(["false", "null", "required_error"]).default("null"),
  ambiguousPolicy: z.enum(["always_review", "nearest_guess"]).default("always_review"),
  regionMode: z.enum(["box", "full_area"]).default("box"),
  // 교차 검증: ITSUWA 합격/불합격처럼 동시 true 불가 대상 필드 (PRD §4.3)
  exclusiveWithFieldId: z.string().optional(),
});

export const fieldConfigSchema = z.object({
  text: textConfigSchema.partial().optional(),
  number: numberConfigSchema.partial().optional(),
  check: checkConfigSchema.partial().optional(),
});

export const createFieldSchema = z.object({
  pageNo: z.number().int().min(1).default(1),
  label: z.string().min(1),
  description: z.string().optional(),
  dataKey: z.string().min(1).optional(),
  type: fieldTypeSchema,
  box: boxSchema,
  required: z.boolean().default(false),
  config: fieldConfigSchema.default({}),
});

export const updateFieldSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  dataKey: z.string().min(1).optional(),
  type: fieldTypeSchema.optional(),
  box: boxSchema.optional(),
  required: z.boolean().optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  status: z.enum(["suggested", "confirmed"]).optional(),
  config: fieldConfigSchema.optional(),
});

export type FieldType = z.infer<typeof fieldTypeSchema>;
export type FieldConfig = z.infer<typeof fieldConfigSchema>;

// 필드 생성 시 유형별 기본값을 채운다 (PRD §4.1~4.3 "기본 권장값").
export function defaultConfigForType(type: FieldType, overrides: FieldConfig = {}): FieldConfig {
  if (type === "text") return { text: textConfigSchema.parse(overrides.text ?? {}) };
  if (type === "number") return { number: numberConfigSchema.parse(overrides.number ?? {}) };
  return { check: checkConfigSchema.parse(overrides.check ?? {}) };
}

// PRD_양식편집기_상세 §11.1: 첫 행 필드 다중선택 후 "반복행으로 묶기"
export const createRepeatGroupSchema = z.object({
  label: z.string().min(1),
  dataKey: z.string().min(1).optional(),
  fieldIds: z.array(z.string()).min(1),
  maxRows: z.number().int().min(1).default(25),
  blankRowPolicy: z.enum(["exclude", "include"]).default("exclude"),
  useRowNumber: z.boolean().default(false),
  allowDuplicate: z.boolean().default(false),
});

export const updateRepeatGroupSchema = z.object({
  label: z.string().min(1).optional(),
  dataKey: z.string().min(1).optional(),
  maxRows: z.number().int().min(1).optional(),
  blankRowPolicy: z.enum(["exclude", "include"]).optional(),
  useRowNumber: z.boolean().optional(),
  allowDuplicate: z.boolean().optional(),
  area: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      w: z.number().gt(0).max(1),
    })
    .optional(),
  rowHeight: z.number().gt(0).max(1).optional(),
});

export const createTemplateSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1),
  pageCount: z.number().int().min(1).default(1),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "retired"]).optional(),
});

export const importDocumentSchema = z.object({
  pageImages: z.array(z.string()).min(1),
});

export const aiDetectionSchema = z.object({
  imageDataUri: z.string().startsWith("data:"),
  pageNo: z.number().int().min(1).default(1),
});

export const applyAiCandidatesSchema = z.object({
  acceptFieldIds: z.array(z.string()).default([]),
  rejectFieldIds: z.array(z.string()).default([]),
});

export const updateFieldValueSchema = z.object({
  finalValue: z.string().nullable(),
});

export const reopenDocumentSchema = z.object({
  reason: z.string().min(1),
});

// PRD_양식편집기_상세 §8.0: 1차 데모 최대 20MB
export const uploadTemplatePdfSchema = z.object({
  pdfDataUri: z.string().startsWith("data:application/pdf;base64,"),
  pageCount: z.number().int().min(1),
});

export const exportRequestSchema = z.object({
  documentIds: z.array(z.string()).min(1),
});
