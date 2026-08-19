// OCR 원본값 → 정규화값 (PRD_양식편집기_상세 §4.2 raw/normalized 분리 원칙).
// 서버 검증 규칙으로 처리하고 AI에게 다시 맡기지 않는다 (PRD_폼솔루션 §7.7.3 역할 분담표).
import type { FieldType } from "@/types";

function normalizeDate(raw: string): string | null {
  const m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(raw);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = mo.padStart(2, "0");
  const day = d.padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${y}-${month}-${day}`;
}

function normalizeTime(raw: string): string | null {
  const m = /(\d{1,2})\D+(\d{1,2})/.exec(raw);
  if (!m) return null;
  const [, hRaw, mi] = m;
  let h = Number(hRaw);
  if (h > 23 || Number(mi) > 59) return null;
  // 오후/PM 표기는 12시간제로 적힌 경우가 많다 (예: "오후 2시 30분" = 14:30).
  const isPm = /오후|午後|PM|pm/.test(raw);
  const isAm = /오전|午前|AM|am/.test(raw);
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${mi.padStart(2, "0")}`;
}

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
  if (type === "date") return normalizeDate(raw);
  if (type === "time") return normalizeTime(raw);
  return raw;
}
