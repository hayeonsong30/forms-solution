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

// PRD_양식편집기_상세 §9.3
export const ocrConfigSchema = z.object({
  enabled: z.boolean().default(true),
  formatHint: z.string().optional(),
  lowConfidencePolicy: z.enum(["auto_flag", "block_confirm"]).default("auto_flag"),
  autoRotate: z.boolean().default(true),
  contrastEnhance: z.boolean().default(false),
});

export const fieldConfigSchema = z.object({
  text: textConfigSchema.partial().optional(),
  number: numberConfigSchema.partial().optional(),
  check: checkConfigSchema.partial().optional(),
  ocr: ocrConfigSchema.partial().optional(),
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
  const ocr = ocrConfigSchema.parse(overrides.ocr ?? {});
  if (type === "text") return { text: textConfigSchema.parse(overrides.text ?? {}), ocr };
  if (type === "number") return { number: numberConfigSchema.parse(overrides.number ?? {}), ocr };
  return { check: checkConfigSchema.parse(overrides.check ?? {}), ocr };
}

export const createTemplateSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1),
  pageCount: z.number().int().min(1).default(1),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "retired"]).optional(),
});
