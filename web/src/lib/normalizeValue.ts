// OCR 원본값 → 정규화값 (PRD_양식편집기_상세 §4.2 raw/normalized 분리 원칙).
// 서버 검증 규칙으로 처리하고 AI에게 다시 맡기지 않는다 (PRD_폼솔루션 §7.7.3 역할 분담표).
import type { FieldType } from "@/types";

export function normalizeValue(type: FieldType, raw: string | null): string | null {
  if (raw === null) return null;
  if (type === "number") {
    const m = /-?\d+(\.\d+)?/.exec(raw.replace(/[,\s]/g, ""));
    return m ? m[0] : null;
  }
  if (type === "check") {
    const v = raw.trim().toLowerCase();
    if (v === "true") return "true";
    if (v === "false") return "false";
    return null;
  }
  return raw;
}
