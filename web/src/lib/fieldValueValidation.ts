// 사용자가 최종값을 입력했을 때 적용하는 서버 검증 규칙 (PRD_폼솔루션 §7.7.14~16).
// review_reasons는 PRD가 정의한 목록 중 1차 데모 필드 범위(텍스트/숫자/체크)에 해당하는
// 항목만 사용한다: required_missing, type_mismatch, number_out_of_range, choice_conflict.
import type { CheckConfig, FieldConfig, FieldType, NumberConfig, TextConfig } from "@/types";
import { normalizeValue } from "@/lib/normalizeValue";

export type ReviewReason =
  | "required_missing"
  | "type_mismatch"
  | "number_out_of_range"
  | "choice_conflict";

export function validateFieldValue(input: {
  type: FieldType;
  required: boolean;
  config: FieldConfig;
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

  const normalized = normalizeValue(type, finalValue);

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
    void (config.check as CheckConfig | undefined);
    if (normalized === null) reasons.push("type_mismatch");
  } else {
    // 텍스트는 문자 정책 위반이어도 값을 지우지 않고 원값을 보존한다 (PRD §4.1).
    const cfg = (config.text ?? {}) as TextConfig;
    if (cfg.maxLength && finalValue.length > cfg.maxLength) reasons.push("type_mismatch");
  }

  return { normalizedValue: normalized, reviewReasons: reasons };
}
