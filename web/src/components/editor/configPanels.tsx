"use client";

import { useState } from "react";
import type { CheckConfig, ChoiceConfig, DateConfig, FieldDTO, NumberConfig, TextConfig, TimeConfig } from "@/types";
import { useLanguage, type Lang } from "@/lib/language";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-100)]";

const STRINGS = {
  ko: {
    text: {
      writingMode: { label: "작성 형태", single: "한 줄", multiline: "여러 줄" },
      language: { label: "인식 언어", ja: "일본어", ko: "한국어", en: "영어", auto: "자동" },
      charPolicy: {
        label: "문자 정책",
        all: "모든 문자",
        numericIncluded: "숫자 포함 문자",
        alnum: "영숫자",
      },
      maxLength: "최대 길이",
      preserveWhitespace: "공백 보존",
      preserveNewline: "줄바꿈 보존",
    },
    number: {
      numberFormat: { label: "숫자 형식", integer: "정수", decimal: "소수" },
      decimalPlaces: "소수 자릿수 (0~6)",
      allowNegative: "음수 허용",
      min: "최소",
      max: "최대",
      unit: "단위",
      unitPlaceholder: "예: kg, 個",
      thousandsSeparator: "천 단위 구분 허용",
      allowBlank: "빈칸 허용",
    },
    marks: {
      trueOptions: [
        { value: "CHECK", icon: "✓", label: "체크" },
        { value: "V", icon: "V", label: "브이" },
        { value: "CIRCLE", icon: "●", label: "동그라미" },
        { value: "FILL", icon: "▪", label: "칸 채움" },
        { value: "SLASH", icon: "╱", label: "사선" },
      ],
      falseOptions: [
        { value: "X", icon: "✕", label: "엑스" },
        { value: "CROSS", icon: "×", label: "곱하기" },
      ],
    },
    check: {
      mode: { label: "판정 방식", presence: "체크 유무", symbolClassification: "true/false 기호" },
      outputMode: { label: "출력 형식", boolean: "T/F로 변환 (true/false)", symbol: "필기 인식 그대로 (V·O·X 등)" },
      trueMarks: "true 표시",
      falseMarks: "false 표시",
      blankValue: { label: "빈칸 처리", null: "null (미기재로 간주)", false: "false", requiredError: "필수 오류" },
    },
    date: {
      inputFormat: {
        label: "입력 형식",
        auto: "자동 판별",
        ymdSlash: "YYYY/MM/DD",
        ymdDash: "YYYY-MM-DD",
        ymdKo: "YYYY년 MM월 DD일",
        mdNoYear: "MM/DD (연도 생략)",
      },
      outputFormat: { label: "출력 형식", ymdDash: "YYYY-MM-DD", source: "원본 표기 유지" },
    },
    time: {
      inputMode: {
        label: "입력 형식",
        auto: "자동 판별",
        h24: "24시간제",
        h12: "오전·오후 12시간제",
        splitHourMinute: "시·분 분리 기입",
      },
      outputFormat: { label: "출력 형식", hm: "HH:mm", source: "원본 표기 유지" },
    },
    choice: {
      mode: { label: "선택 방식", single: "단일 선택", multiple: "다중 선택" },
      conflictPolicy: {
        label: "충돌 정책",
        reviewRequired: "두 개 이상 표시되면 확인 필요",
        lastMarked: "마지막으로 표시된 값 사용",
        firstMarked: "처음 표시된 값 사용",
      },
      csvPolicy: {
        label: "CSV 방식",
        delimiter: "구분자로 한 열에 결합",
        oneColumnPerOption: "옵션별 열 분리",
      },
    },
  },
  ja: {
    text: {
      writingMode: { label: "記入形式", single: "1行", multiline: "複数行" },
      language: { label: "認識言語", ja: "日本語", ko: "韓国語", en: "英語", auto: "自動" },
      charPolicy: {
        label: "文字ポリシー",
        all: "すべての文字",
        numericIncluded: "数字を含む文字",
        alnum: "英数字",
      },
      maxLength: "最大文字数",
      preserveWhitespace: "空白を保持",
      preserveNewline: "改行を保持",
    },
    number: {
      numberFormat: { label: "数値形式", integer: "整数", decimal: "小数" },
      decimalPlaces: "小数桁数（0〜6）",
      allowNegative: "負数を許可",
      min: "最小値",
      max: "最大値",
      unit: "単位",
      unitPlaceholder: "例: kg, 個",
      thousandsSeparator: "桁区切りを許可",
      allowBlank: "空欄を許可",
    },
    marks: {
      trueOptions: [
        { value: "CHECK", icon: "✓", label: "チェック" },
        { value: "V", icon: "V", label: "V字" },
        { value: "CIRCLE", icon: "●", label: "丸" },
        { value: "FILL", icon: "▪", label: "塗りつぶし" },
        { value: "SLASH", icon: "╱", label: "斜線" },
      ],
      falseOptions: [
        { value: "X", icon: "✕", label: "バツ" },
        { value: "CROSS", icon: "×", label: "掛け算記号" },
      ],
    },
    check: {
      mode: { label: "判定方式", presence: "チェックの有無", symbolClassification: "true/false記号" },
      outputMode: { label: "出力形式", boolean: "T/Fに変換（true/false）", symbol: "手書き認識のまま（V・O・Xなど）" },
      trueMarks: "true表示",
      falseMarks: "false表示",
      blankValue: { label: "空欄の扱い", null: "null（未記入とみなす）", false: "false", requiredError: "必須エラー" },
    },
    date: {
      inputFormat: {
        label: "入力形式",
        auto: "自動判別",
        ymdSlash: "YYYY/MM/DD",
        ymdDash: "YYYY-MM-DD",
        ymdKo: "YYYY年MM月DD日",
        mdNoYear: "MM/DD（年省略）",
      },
      outputFormat: { label: "出力形式", ymdDash: "YYYY-MM-DD", source: "元の表記を維持" },
    },
    time: {
      inputMode: {
        label: "入力形式",
        auto: "自動判別",
        h24: "24時間制",
        h12: "午前・午後12時間制",
        splitHourMinute: "時・分を分けて記入",
      },
      outputFormat: { label: "出力形式", hm: "HH:mm", source: "元の表記を維持" },
    },
    choice: {
      mode: { label: "選択方式", single: "単一選択", multiple: "複数選択" },
      conflictPolicy: {
        label: "競合ポリシー",
        reviewRequired: "2つ以上表示された場合は確認要",
        lastMarked: "最後に表示された値を使用",
        firstMarked: "最初に表示された値を使用",
      },
      csvPolicy: {
        label: "CSV方式",
        delimiter: "区切り文字で1列に結合",
        oneColumnPerOption: "選択肢ごとに列を分離",
      },
    },
  },
} satisfies Record<Lang, unknown>;

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
  const { lang } = useLanguage();
  const s = STRINGS[lang].text;
  const v = value ?? ({} as TextConfig);
  return (
    <>
      <Field label={s.writingMode.label}>
        <select
          className={inputClass}
          value={v.writingMode ?? "single"}
          onChange={(e) => onChange({ writingMode: e.target.value as TextConfig["writingMode"] })}
        >
          <option value="single">{s.writingMode.single}</option>
          <option value="multiline">{s.writingMode.multiline}</option>
        </select>
      </Field>
      <Field label={s.language.label}>
        <select
          className={inputClass}
          value={v.language ?? "ja"}
          onChange={(e) => onChange({ language: e.target.value as TextConfig["language"] })}
        >
          <option value="ja">{s.language.ja}</option>
          <option value="ko">{s.language.ko}</option>
          <option value="en">{s.language.en}</option>
          <option value="auto">{s.language.auto}</option>
        </select>
      </Field>
      <Field label={s.charPolicy.label}>
        <select
          className={inputClass}
          value={v.charPolicy ?? "all"}
          onChange={(e) => onChange({ charPolicy: e.target.value as TextConfig["charPolicy"] })}
        >
          <option value="all">{s.charPolicy.all}</option>
          <option value="numeric_included">{s.charPolicy.numericIncluded}</option>
          <option value="alnum">{s.charPolicy.alnum}</option>
        </select>
      </Field>
      <Field label={s.maxLength}>
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
        {s.preserveWhitespace}
      </label>
      {v.writingMode === "multiline" && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.preserveNewline ?? false} onChange={(e) => onChange({ preserveNewline: e.target.checked })} />
          {s.preserveNewline}
        </label>
      )}
    </>
  );
}

export function NumberConfigPanel({ value, onChange }: { value?: NumberConfig; onChange: (p: Partial<NumberConfig>) => void }) {
  const { lang } = useLanguage();
  const s = STRINGS[lang].number;
  const v = value ?? ({} as NumberConfig);
  return (
    <>
      <Field label={s.numberFormat.label}>
        <select
          className={inputClass}
          value={v.numberFormat ?? "integer"}
          onChange={(e) => onChange({ numberFormat: e.target.value as NumberConfig["numberFormat"] })}
        >
          <option value="integer">{s.numberFormat.integer}</option>
          <option value="decimal">{s.numberFormat.decimal}</option>
        </select>
      </Field>
      {v.numberFormat === "decimal" && (
        <Field label={s.decimalPlaces}>
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
        {s.allowNegative}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Field label={s.min}>
          <input
            type="number"
            className={inputClass}
            defaultValue={v.min ?? ""}
            onBlur={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label={s.max}>
          <input
            type="number"
            className={inputClass}
            defaultValue={v.max ?? ""}
            onBlur={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>
      <Field label={s.unit}>
        <input className={inputClass} placeholder={s.unitPlaceholder} defaultValue={v.unit ?? ""} onBlur={(e) => onChange({ unit: e.target.value || undefined })} />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.thousandsSeparator ?? false} onChange={(e) => onChange({ thousandsSeparator: e.target.checked })} />
        {s.thousandsSeparator}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.allowBlank ?? true} onChange={(e) => onChange({ allowBlank: e.target.checked })} />
        {s.allowBlank}
      </label>
    </>
  );
}

function MarkToggleGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; icon: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            onClick={() => onChange(active ? selected.filter((m) => m !== opt.value) : [...selected, opt.value])}
            className={`w-9 h-9 rounded-lg border text-base leading-none cursor-pointer flex items-center justify-center ${
              active
                ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                : "border-[var(--color-border)] text-slate-500 hover:bg-slate-50"
            }`}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

export function CheckConfigPanel({
  value,
  onChange,
}: {
  value?: CheckConfig;
  onChange: (p: Partial<CheckConfig>) => void;
}) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const cs = s.check;
  const v = value ?? ({} as CheckConfig);
  return (
    <>
      <Field label={cs.mode.label}>
        <select
          className={inputClass}
          value={v.mode ?? "symbol_classification"}
          onChange={(e) => onChange({ mode: e.target.value as CheckConfig["mode"] })}
        >
          <option value="presence">{cs.mode.presence}</option>
          <option value="symbol_classification">{cs.mode.symbolClassification}</option>
        </select>
      </Field>
      <Field label={cs.outputMode.label}>
        <select
          className={inputClass}
          value={v.outputMode ?? "boolean"}
          onChange={(e) => onChange({ outputMode: e.target.value as CheckConfig["outputMode"] })}
        >
          <option value="boolean">{cs.outputMode.boolean}</option>
          <option value="symbol">{cs.outputMode.symbol}</option>
        </select>
      </Field>
      <Field label={cs.trueMarks}>
        <MarkToggleGroup options={s.marks.trueOptions} selected={v.trueMarks ?? ["CHECK", "V"]} onChange={(trueMarks) => onChange({ trueMarks })} />
      </Field>
      {v.mode === "symbol_classification" && (
        <Field label={cs.falseMarks}>
          <MarkToggleGroup options={s.marks.falseOptions} selected={v.falseMarks ?? ["X"]} onChange={(falseMarks) => onChange({ falseMarks })} />
        </Field>
      )}
      <Field label={cs.blankValue.label}>
        <select className={inputClass} value={v.blankValue ?? "null"} onChange={(e) => onChange({ blankValue: e.target.value as CheckConfig["blankValue"] })}>
          <option value="null">{cs.blankValue.null}</option>
          <option value="false">{cs.blankValue.false}</option>
          <option value="required_error">{cs.blankValue.requiredError}</option>
        </select>
      </Field>
    </>
  );
}

export function DateConfigPanel({ value, onChange }: { value?: DateConfig; onChange: (p: Partial<DateConfig>) => void }) {
  const { lang } = useLanguage();
  const s = STRINGS[lang].date;
  const v = value ?? ({} as DateConfig);
  return (
    <>
      <Field label={s.inputFormat.label}>
        <select
          className={inputClass}
          value={v.inputFormat ?? "auto"}
          onChange={(e) => onChange({ inputFormat: e.target.value as DateConfig["inputFormat"] })}
        >
          <option value="auto">{s.inputFormat.auto}</option>
          <option value="YYYY/MM/DD">{s.inputFormat.ymdSlash}</option>
          <option value="YYYY-MM-DD">{s.inputFormat.ymdDash}</option>
          <option value="YYYY년 MM월 DD일">{s.inputFormat.ymdKo}</option>
          <option value="MM/DD">{s.inputFormat.mdNoYear}</option>
        </select>
      </Field>
      <Field label={s.outputFormat.label}>
        <select
          className={inputClass}
          value={v.outputFormat ?? "YYYY-MM-DD"}
          onChange={(e) => onChange({ outputFormat: e.target.value as DateConfig["outputFormat"] })}
        >
          <option value="YYYY-MM-DD">{s.outputFormat.ymdDash}</option>
          <option value="source">{s.outputFormat.source}</option>
        </select>
      </Field>
    </>
  );
}

export function TimeConfigPanel({ value, onChange }: { value?: TimeConfig; onChange: (p: Partial<TimeConfig>) => void }) {
  const { lang } = useLanguage();
  const s = STRINGS[lang].time;
  const v = value ?? ({} as TimeConfig);
  return (
    <>
      <Field label={s.inputMode.label}>
        <select
          className={inputClass}
          value={v.inputMode ?? "auto"}
          onChange={(e) => onChange({ inputMode: e.target.value as TimeConfig["inputMode"] })}
        >
          <option value="auto">{s.inputMode.auto}</option>
          <option value="24h">{s.inputMode.h24}</option>
          <option value="12h">{s.inputMode.h12}</option>
          <option value="split_hour_minute">{s.inputMode.splitHourMinute}</option>
        </select>
      </Field>
      <Field label={s.outputFormat.label}>
        <select
          className={inputClass}
          value={v.outputFormat ?? "HH:mm"}
          onChange={(e) => onChange({ outputFormat: e.target.value as TimeConfig["outputFormat"] })}
        >
          <option value="HH:mm">{s.outputFormat.hm}</option>
          <option value="source">{s.outputFormat.source}</option>
        </select>
      </Field>
    </>
  );
}

export function ChoiceConfigPanel({ value, onChange }: { value?: ChoiceConfig; onChange: (p: Partial<ChoiceConfig>) => void }) {
  const { lang } = useLanguage();
  const s = STRINGS[lang].choice;
  const v = value ?? ({} as ChoiceConfig);
  return (
    <>
      <Field label={s.mode.label}>
        <select className={inputClass} value={v.mode ?? "single"} onChange={(e) => onChange({ mode: e.target.value as ChoiceConfig["mode"] })}>
          <option value="single">{s.mode.single}</option>
          <option value="multiple">{s.mode.multiple}</option>
        </select>
      </Field>
      <Field label={s.conflictPolicy.label}>
        <select
          className={inputClass}
          value={v.conflictPolicy ?? "review_required"}
          onChange={(e) => onChange({ conflictPolicy: e.target.value as ChoiceConfig["conflictPolicy"] })}
        >
          <option value="review_required">{s.conflictPolicy.reviewRequired}</option>
          <option value="last_marked">{s.conflictPolicy.lastMarked}</option>
          <option value="first_marked">{s.conflictPolicy.firstMarked}</option>
        </select>
      </Field>
      <Field label={s.csvPolicy.label}>
        <select
          className={inputClass}
          value={v.csvPolicy ?? "delimiter"}
          onChange={(e) => onChange({ csvPolicy: e.target.value as ChoiceConfig["csvPolicy"] })}
        >
          <option value="delimiter">{s.csvPolicy.delimiter}</option>
          <option value="one_column_per_option">{s.csvPolicy.oneColumnPerOption}</option>
        </select>
      </Field>
    </>
  );
}

export { inputClass };
