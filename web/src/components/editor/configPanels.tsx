"use client";

import { useState } from "react";
import type { CheckConfig, ChoiceConfig, DateConfig, FieldDTO, NumberConfig, TextConfig, TimeConfig } from "@/types";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)]";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

export function Section({
  title,
  children,
  collapsible,
  collapsed,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="p-4">
      <button
        className="flex items-center justify-between w-full text-left font-medium text-sm mb-3"
        onClick={collapsible ? onToggle : undefined}
      >
        {title}
        {collapsible && <span className="text-slate-400">{collapsed ? "▸" : "▾"}</span>}
      </button>
      {(!collapsible || !collapsed) && <div className="space-y-3 text-sm">{children}</div>}
    </div>
  );
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

export function PercentField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState((value * 100).toFixed(1));
  return (
    <Field label={`${label} (%)`}>
      <input
        type="number"
        step={0.1}
        className={inputClass}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => setLocal((value * 100).toFixed(1))}
        onBlur={() => {
          const n = Number(local);
          if (!Number.isNaN(n)) onCommit(clamp(n / 100, 0, 1));
        }}
      />
    </Field>
  );
}

export function TextConfigPanel({ value, onChange }: { value?: TextConfig; onChange: (p: Partial<TextConfig>) => void }) {
  const v = value ?? ({} as TextConfig);
  return (
    <>
      <Field label="작성 형태">
        <select
          className={inputClass}
          value={v.writingMode ?? "single"}
          onChange={(e) => onChange({ writingMode: e.target.value as TextConfig["writingMode"] })}
        >
          <option value="single">한 줄</option>
          <option value="multiline">여러 줄</option>
        </select>
      </Field>
      <Field label="인식 언어">
        <select
          className={inputClass}
          value={v.language ?? "ja"}
          onChange={(e) => onChange({ language: e.target.value as TextConfig["language"] })}
        >
          <option value="ja">일본어</option>
          <option value="ko">한국어</option>
          <option value="en">영어</option>
          <option value="auto">자동</option>
        </select>
      </Field>
      <Field label="문자 정책">
        <select
          className={inputClass}
          value={v.charPolicy ?? "all"}
          onChange={(e) => onChange({ charPolicy: e.target.value as TextConfig["charPolicy"] })}
        >
          <option value="all">모든 문자</option>
          <option value="numeric_included">숫자 포함 문자</option>
          <option value="alnum">영숫자</option>
          <option value="custom_pattern">사용자 패턴</option>
        </select>
      </Field>
      {v.charPolicy === "custom_pattern" && (
        <Field label="사용자 패턴 (정규식)">
          <input className={inputClass} defaultValue={v.customPattern ?? ""} onBlur={(e) => onChange({ customPattern: e.target.value })} />
        </Field>
      )}
      <Field label="최대 길이">
        <input
          type="number"
          min={1}
          className={inputClass}
          defaultValue={v.maxLength ?? ""}
          onBlur={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
        />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.preserveWhitespace ?? false} onChange={(e) => onChange({ preserveWhitespace: e.target.checked })} />
        공백 보존
      </label>
      {v.writingMode === "multiline" && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.preserveNewline ?? false} onChange={(e) => onChange({ preserveNewline: e.target.checked })} />
          줄바꿈 보존
        </label>
      )}
    </>
  );
}

export function NumberConfigPanel({ value, onChange }: { value?: NumberConfig; onChange: (p: Partial<NumberConfig>) => void }) {
  const v = value ?? ({} as NumberConfig);
  return (
    <>
      <Field label="숫자 형식">
        <select
          className={inputClass}
          value={v.numberFormat ?? "integer"}
          onChange={(e) => onChange({ numberFormat: e.target.value as NumberConfig["numberFormat"] })}
        >
          <option value="integer">정수</option>
          <option value="decimal">소수</option>
        </select>
      </Field>
      {v.numberFormat === "decimal" && (
        <Field label="소수 자릿수 (0~6)">
          <input
            type="number"
            min={0}
            max={6}
            className={inputClass}
            defaultValue={v.decimalPlaces ?? 0}
            onBlur={(e) => onChange({ decimalPlaces: Number(e.target.value) })}
          />
        </Field>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.allowNegative ?? false} onChange={(e) => onChange({ allowNegative: e.target.checked })} />
        음수 허용
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Field label="최소">
          <input
            type="number"
            className={inputClass}
            defaultValue={v.min ?? ""}
            onBlur={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="최대">
          <input
            type="number"
            className={inputClass}
            defaultValue={v.max ?? ""}
            onBlur={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>
      <Field label="단위">
        <input className={inputClass} placeholder="예: kg, 個" defaultValue={v.unit ?? ""} onBlur={(e) => onChange({ unit: e.target.value || undefined })} />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.thousandsSeparator ?? false} onChange={(e) => onChange({ thousandsSeparator: e.target.checked })} />
        천 단위 구분 허용
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.allowBlank ?? true} onChange={(e) => onChange({ allowBlank: e.target.checked })} />
        빈칸 허용
      </label>
    </>
  );
}

export function CheckConfigPanel({
  value,
  otherCheckFields,
  onChange,
}: {
  value?: CheckConfig;
  otherCheckFields: FieldDTO[];
  onChange: (p: Partial<CheckConfig>) => void;
}) {
  const v = value ?? ({} as CheckConfig);
  return (
    <>
      <Field label="판정 방식">
        <select
          className={inputClass}
          value={v.mode ?? "symbol_classification"}
          onChange={(e) => onChange({ mode: e.target.value as CheckConfig["mode"] })}
        >
          <option value="presence">체크 유무</option>
          <option value="symbol_classification">true/false 기호</option>
        </select>
      </Field>
      <Field label="true 표시 (쉼표 구분)">
        <input
          className={inputClass}
          defaultValue={(v.trueMarks ?? ["CHECK", "V"]).join(", ")}
          onBlur={(e) => onChange({ trueMarks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
      {v.mode === "symbol_classification" && (
        <Field label="false 표시 (쉼표 구분)">
          <input
            className={inputClass}
            defaultValue={(v.falseMarks ?? ["X"]).join(", ")}
            onBlur={(e) => onChange({ falseMarks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
      )}
      <Field label="빈칸 처리">
        <select className={inputClass} value={v.blankValue ?? "null"} onChange={(e) => onChange({ blankValue: e.target.value as CheckConfig["blankValue"] })}>
          <option value="null">null (미기재로 간주)</option>
          <option value="false">false</option>
          <option value="required_error">필수 오류</option>
        </select>
      </Field>
      <Field label="애매한 표시">
        <select
          className={inputClass}
          value={v.ambiguousPolicy ?? "always_review"}
          onChange={(e) => onChange({ ambiguousPolicy: e.target.value as CheckConfig["ambiguousPolicy"] })}
        >
          <option value="always_review">항상 검수</option>
          <option value="nearest_guess">가장 가까운 값 추천</option>
        </select>
      </Field>
      <Field label="선택 영역">
        <select className={inputClass} value={v.regionMode ?? "box"} onChange={(e) => onChange({ regionMode: e.target.value as CheckConfig["regionMode"] })}>
          <option value="box">박스 내부</option>
          <option value="full_area">영역 전체</option>
        </select>
      </Field>
      {otherCheckFields.length === 0 && (
        <p className="text-[11px] text-slate-400">체크 필드가 하나 더 있으면 검증 섹션에서 교차 검증을 설정할 수 있습니다.</p>
      )}
    </>
  );
}

export function DateConfigPanel({ value, onChange }: { value?: DateConfig; onChange: (p: Partial<DateConfig>) => void }) {
  const v = value ?? ({} as DateConfig);
  return (
    <>
      <Field label="표시 형식">
        <input className={inputClass} defaultValue={v.format ?? "YYYY-MM-DD"} onBlur={(e) => onChange({ format: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.allowBlank ?? true} onChange={(e) => onChange({ allowBlank: e.target.checked })} />
        빈칸 허용
      </label>
    </>
  );
}

export function TimeConfigPanel({ value, onChange }: { value?: TimeConfig; onChange: (p: Partial<TimeConfig>) => void }) {
  const v = value ?? ({} as TimeConfig);
  return (
    <>
      <Field label="표시 형식">
        <input className={inputClass} defaultValue={v.format ?? "HH:mm"} onBlur={(e) => onChange({ format: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.allowBlank ?? true} onChange={(e) => onChange({ allowBlank: e.target.checked })} />
        빈칸 허용
      </label>
    </>
  );
}

export function ChoiceConfigPanel({ value, onChange }: { value?: ChoiceConfig; onChange: (p: Partial<ChoiceConfig>) => void }) {
  const v = value ?? ({} as ChoiceConfig);
  return (
    <>
      <Field label="선택 방식">
        <select className={inputClass} value={v.mode ?? "single"} onChange={(e) => onChange({ mode: e.target.value as ChoiceConfig["mode"] })}>
          <option value="single">단일 선택</option>
          <option value="multiple">다중 선택</option>
        </select>
      </Field>
      <Field label="선택지 (줄바꿈으로 구분)">
        <textarea
          className={inputClass}
          rows={4}
          defaultValue={(v.options ?? []).join("\n")}
          onBlur={(e) =>
            onChange({
              options: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
    </>
  );
}

export { inputClass };
