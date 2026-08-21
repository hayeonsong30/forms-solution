// OCR 원본값 → 정규화값 (PRD_양식편집기_상세 §4.2 raw/normalized 분리 원칙).
// 서버 검증 규칙으로 처리하고 AI에게 다시 맡기지 않는다 (PRD_폼솔루션 §7.7.3 역할 분담표).
import type { CheckConfig, DateConfig, FieldConfig, FieldType, TimeConfig } from "@/types";

// symbol 모드: 실제로 쓴 기호(V·O·X·✓ 등)를 true/false로 뭉개지 않고 그대로 남긴다.
// trueMarks/falseMarks에 등록된 기호 중 하나와 대소문자 무시하고 일치해야 유효한 값으로 본다.
function normalizeCheckSymbol(raw: string, config?: CheckConfig): string | null {
  const trimmed = raw.trim();
  const known = [...(config?.trueMarks ?? []), ...(config?.falseMarks ?? [])];
  if (known.length === 0) return trimmed || null;
  const match = known.find((m) => m.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}

// inputFormat/inputMode는 관대한 공용 파서를 그대로 쓰고(실제 필기가 정확히 한 형식만
// 따르지 않는 경우가 많다), missingYearPolicy·minuteStep·outputFormat만 실제로 분기한다.
function normalizeDate(raw: string, config?: DateConfig, documentYear?: number): string | null {
  const full = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(raw);
  let year: number;
  let month: number;
  let day: number;
  if (full) {
    year = Number(full[1]);
    month = Number(full[2]);
    day = Number(full[3]);
  } else {
    const short = /^\s*(\d{1,2})\D+(\d{1,2})\s*$/.exec(raw);
    if (!short) return null;
    const policy = config?.missingYearPolicy ?? "review_required";
    if (policy === "review_required") return null;
    year = policy === "document_year" ? (documentYear ?? new Date().getFullYear()) : new Date().getFullYear();
    month = Number(short[1]);
    day = Number(short[2]);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (config?.outputFormat === "source") return raw.trim();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeTime(raw: string, config?: TimeConfig): string | null {
  const m = /(\d{1,2})\D+(\d{1,2})/.exec(raw);
  if (!m) return null;
  const [, hRaw, miRaw] = m;
  let h = Number(hRaw);
  let mi = Number(miRaw);
  if (h > 23 || mi > 59) return null;
  // 오후/PM 표기는 12시간제로 적힌 경우가 많다 (예: "오후 2시 30분" = 14:30).
  const isPm = /오후|午後|PM|pm/.test(raw);
  const isAm = /오전|午前|AM|am/.test(raw);
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  const step = config?.minuteStep;
  if (step && step !== "free") {
    mi = Math.round(mi / step) * step;
    if (mi === 60) {
      mi = 0;
      h = (h + 1) % 24;
    }
  }
  if (config?.outputFormat === "source") return raw.trim();
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function normalizeValue(type: FieldType, raw: string | null, config?: FieldConfig, documentYear?: number): string | null {
  if (raw === null) return null;
  if (type === "number") {
    const m = /-?\d+(\.\d+)?/.exec(raw.replace(/[,\s]/g, ""));
    return m ? m[0] : null;
  }
  if (type === "check") {
    if (config?.check?.outputMode === "symbol") return normalizeCheckSymbol(raw, config.check);
    const v = raw.trim().toLowerCase();
    if (v === "true") return "true";
    if (v === "false") return "false";
    return null;
  }
  if (type === "date") return normalizeDate(raw, config?.date, documentYear);
  if (type === "time") return normalizeTime(raw, config?.time);
  return raw;
}
