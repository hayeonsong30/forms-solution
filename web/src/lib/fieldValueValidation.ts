// 사용자가 최종값을 입력했을 때 적용하는 서버 검증 규칙 (PRD_폼솔루션 §7.7.14~16).
// review_reasons는 PRD가 정의한 목록 중 지원 필드 범위에 해당하는 항목만 사용한다:
// required_missing, type_mismatch, number_out_of_range, invalid_date, invalid_time,
// unknown_choice, choice_conflict.
import type { ChoiceConfig, FieldConfig, FieldType, NumberConfig, TextConfig } from "@/types";
import { normalizeValue } from "@/lib/normalizeValue";

export type ReviewReason =
  | "required_missing"
  | "type_mismatch"
  | "number_out_of_range"
  | "invalid_date"
  | "invalid_time"
  | "unknown_choice"
  | "choice_conflict";

export function validateFieldValue(input: {
  type: FieldType;
  required: boolean;
  config: FieldConfig;
  // choice 유형의 유효 저장값 목록 (ChoiceOption.storedValue). 관계형 테이블이 없는
  // 반복행 열처럼 목록을 알 수 없을 때는 생략 — 이 경우 값 검사를 건너뛴다.
  choiceOptions?: string[];
  // date 유형의 missingYearPolicy가 "document_year"일 때 채울 연도 (문서 생성 연도).
  documentYear?: number;
  finalValue: string | null;
}): { normalizedValue: string | null; reviewReasons: ReviewReason[] } {
  const { type, required, config, finalValue } = input;
  const reasons: ReviewReason[] = [];
  const isEmpty = finalValue === null || finalValue.trim() === "";

  if (required && isEmpty) {
    reasons.push("required_missing");
    return { normalizedValue: null, reviewReasons: reasons };
  }
  if (isEmpty) return { normalizedValue: null, reviewReasons: [] };

  let normalized = normalizeValue(type, finalValue, config, input.documentYear);

  if (type === "number") {
    const cfg = (config.number ?? {}) as NumberConfig;
    if (normalized === null) {
      reasons.push("type_mismatch");
    } else {
      const n = Number(normalized);
      if ((cfg.min !== undefined && n < cfg.min) || (cfg.max !== undefined && n > cfg.max)) {
        reasons.push("number_out_of_range");
      }
    }
  } else if (type === "check") {
    if (normalized === null) reasons.push("type_mismatch");
  } else if (type === "date") {
    if (normalized === null) reasons.push("invalid_date");
  } else if (type === "time") {
    if (normalized === null) reasons.push("invalid_time");
  } else if (type === "choice") {
    const cfg = (config.choice ?? {}) as ChoiceConfig;
    const validValues = input.choiceOptions ?? [];
    const selected = finalValue.split(",").map((s) => s.trim()).filter(Boolean);
    if (validValues.length > 0 && selected.some((s) => !validValues.includes(s))) {
      reasons.push("unknown_choice");
    }
    // 단일 선택인데 표시된 옵션이 여러 개면 conflictPolicy에 따라 처리한다 (PRD §14.1).
    // "확인 필요" 정책은 값을 지우지 않고 원값을 보존하되 검수 사유만 남긴다(§4.1 원칙과 동일).
    if (cfg.mode === "single" && selected.length > 1) {
      const policy = cfg.conflictPolicy ?? "review_required";
      if (policy === "last_marked") {
        normalized = selected[selected.length - 1];
      } else if (policy === "first_marked") {
        normalized = selected[0];
      } else {
        reasons.push("choice_conflict");
      }
    }
  } else {
    // 텍스트는 문자 정책 위반이어도 값을 지우지 않고 원값을 보존한다 (PRD §4.1).
    const cfg = (config.text ?? {}) as TextConfig;
    if (cfg.maxLength && finalValue.length > cfg.maxLength) reasons.push("type_mismatch");
  }

  return { normalizedValue: normalized, reviewReasons: reasons };
}
