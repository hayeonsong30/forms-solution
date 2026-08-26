import { z } from "zod";

export const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
});

export const fieldTypeSchema = z.enum(["text", "number", "check", "date", "time", "choice"]);

// PRD_양식편집기_상세 §4.1
export const textConfigSchema = z.object({
  writingMode: z.enum(["single", "multiline"]).default("single"),
  language: z.enum(["ja", "ko", "en", "auto"]).default("ja"),
  charPolicy: z.enum(["all", "numeric_included", "alnum"]).default("all"),
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
  // "boolean"(기본): 어떤 기호를 썼든 true/false로 정규화. "symbol": 손으로 쓴 기호
  // (V·O·X·✓ 등) 그대로를 값으로 남긴다 — 화면·Excel 출력도 그 문자 그대로 나간다.
  outputMode: z.enum(["boolean", "symbol"]).default("boolean"),
});

// 편집기 상세 PRD §4.4는 1차 데모에서 날짜·시간·라디오/다중선택을 제외했지만, 프로토타입은
// 실제로 6종(텍스트/숫자/날짜/시간/체크/선택)을 지원한다 — 사용자가 프로토타입 기준으로
// 가기로 확정(2026-08-19).
export const dateConfigSchema = z.object({
  inputFormat: z.enum(["auto", "YYYY/MM/DD", "YYYY-MM-DD", "YYYY년 MM월 DD일", "MM/DD"]).default("auto"),
  outputFormat: z.enum(["YYYY-MM-DD", "source"]).default("YYYY-MM-DD"),
});

export const timeConfigSchema = z.object({
  inputMode: z.enum(["auto", "24h", "12h", "split_hour_minute"]).default("auto"),
  outputFormat: z.enum(["HH:mm", "source"]).default("HH:mm"),
});

// PRD_양식편집기_상세 §14.1, §15: 옵션 자체(표시명·저장값·판정 영역)는 관계형 ChoiceOption
// 테이블에 저장하고, config.choice는 선택 방식·충돌 정책·CSV 방식만 갖는다.
export const choiceConfigSchema = z.object({
  mode: z.enum(["single", "multiple"]).default("single"),
  conflictPolicy: z.enum(["review_required", "last_marked", "first_marked"]).default("review_required"),
  csvPolicy: z.enum(["delimiter", "one_column_per_option"]).default("delimiter"),
});

export const choiceOptionInputSchema = z.object({
  label: z.string().min(1),
  storedValue: z.string().min(1),
  region: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().gt(0).max(1), h: z.number().gt(0).max(1) })
    .nullable()
    .optional(),
});

export const fieldConfigSchema = z.object({
  text: textConfigSchema.partial().optional(),
  number: numberConfigSchema.partial().optional(),
  check: checkConfigSchema.partial().optional(),
  date: dateConfigSchema.partial().optional(),
  time: timeConfigSchema.partial().optional(),
  choice: choiceConfigSchema.partial().optional(),
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
  // 전달되면 이 필드의 선택 옵션 전체를 대체한다 (부분 추가·삭제가 아님).
  choiceOptions: z.array(choiceOptionInputSchema).optional(),
});

export type FieldType = z.infer<typeof fieldTypeSchema>;
export type FieldConfig = z.infer<typeof fieldConfigSchema>;

// 필드 생성 시 유형별 기본값을 채운다 (PRD §4.1~4.3 "기본 권장값").
export function defaultConfigForType(type: FieldType, overrides: FieldConfig = {}): FieldConfig {
  if (type === "text") return { text: textConfigSchema.parse(overrides.text ?? {}) };
  if (type === "number") return { number: numberConfigSchema.parse(overrides.number ?? {}) };
  if (type === "date") return { date: dateConfigSchema.parse(overrides.date ?? {}) };
  if (type === "time") return { time: timeConfigSchema.parse(overrides.time ?? {}) };
  if (type === "choice") return { choice: choiceConfigSchema.parse(overrides.choice ?? {}) };
  return { check: checkConfigSchema.parse(overrides.check ?? {}) };
}

// 이미 개별 필드(주로 check)로 잡혀 있는 상호배타적 체크박스 그룹을 선택 필드 하나로
// 묶는다. 옵션 영역을 새로 그리지 않고 원본 필드의 좌표를 그대로 재사용한다.
export const mergeToChoiceSchema = z.object({
  fieldIds: z.array(z.string()).min(2),
  label: z.string().min(1),
  dataKey: z.string().min(1).optional(),
  mode: z.enum(["single", "multiple"]).default("single"),
});

// PRD_반복행_기능_구현 §4.3: 良/否처럼 반복행 기준행 안의 두 컬럼을 하나의 단일 선택 값으로 묶는다.
export const mergeRepeatColumnsToChoiceSchema = z.object({
  columnIds: z.array(z.string()).min(2),
  label: z.string().min(1),
  dataKey: z.string().min(1).optional(),
  mode: z.enum(["single", "multiple"]).default("single"),
});

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

// PDF에 이미 인쇄된 행별 고정값 (예: No./점검내용) — OCR 대상이 아니라 그대로 출력에 쓰인다.
export const fixedRowValueSchema = z.object({
  rowIndex: z.number().int().min(0),
  values: z.record(z.string(), z.string()),
});

export const updateRepeatGroupSchema = z.object({
  label: z.string().min(1).optional(),
  dataKey: z.string().min(1).optional(),
  maxRows: z.number().int().min(1).optional(),
  blankRowPolicy: z.enum(["exclude", "include"]).optional(),
  useRowNumber: z.boolean().optional(),
  allowDuplicate: z.boolean().optional(),
  fixedRows: z.array(fixedRowValueSchema).optional(),
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

// 2026-08-20: draft/active + printable 불리언 두 축을 단일 status로 통합.
// draft = 편집 가능·인쇄 불가, printable = 편집 잠김·인쇄 가능.
export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["draft", "printable"]).optional(),
  printCopies: z.number().int().min(1).optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1),
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

export const validateExcelTemplateSchema = z.object({
  fileName: z.string().min(1),
  fileDataUri: z.string().startsWith("data:"),
});

export const saveExcelTemplateSchema = validateExcelTemplateSchema.extend({
  name: z.string().min(1),
});
