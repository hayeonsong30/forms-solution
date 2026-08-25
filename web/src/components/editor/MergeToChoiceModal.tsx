"use client";

import { useState } from "react";
import { Field, inputClass } from "./configPanels";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    title: "선택 필드로 묶기",
    description: (fieldCount: number) =>
      `선택한 필드 ${fieldCount}개를 각각 선택 옵션으로 하는 선택 필드 하나로 묶습니다. 각 필드의 위치는 그대로 옵션 판정 영역이 되고, 원본 필드는 삭제됩니다.`,
    fieldNameLabel: "필드명",
    modeLabel: "선택 방식",
    modeSingle: "단일 선택 (하나만 고를 수 있음)",
    modeMultiple: "다중 선택 (여러 개 고를 수 있음)",
    modeHint:
      "서로 배타적인 선택지가 아니라 각각 독립적으로 체크하는 항목(예: 여러 동의 확인)이라면 묶지 말고 개별 체크 필드로 두는 것을 권장합니다.",
    cancel: "취소",
    create: "묶기",
  },
  ja: {
    title: "選択項目にまとめる",
    description: (fieldCount: number) =>
      `選択した項目${fieldCount}個をそれぞれ選択肢とする選択項目1つにまとめます。各項目の位置はそのまま選択肢の判定領域になり、元の項目は削除されます。`,
    fieldNameLabel: "項目名",
    modeLabel: "選択方式",
    modeSingle: "単一選択（1つだけ選択可能）",
    modeMultiple: "複数選択（複数選択可能）",
    modeHint:
      "互いに排他的な選択肢ではなく、それぞれ独立してチェックする項目（例：複数の同意確認）の場合は、まとめずに個別のチェック項目のままにすることをお勧めします。",
    cancel: "キャンセル",
    create: "まとめる",
  },
} satisfies Record<Lang, unknown>;

export function MergeToChoiceModal({
  fieldCount,
  onCancel,
  onCreate,
}: {
  fieldCount: number;
  onCancel: () => void;
  onCreate: (opts: { label: string; mode: "single" | "multiple" }) => void;
}) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [label, setLabel] = useState(lang === "ko" ? "선택" : "選択");
  const [mode, setMode] = useState<"single" | "multiple">("single");

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-96 p-5 space-y-3">
        <h2 className="font-medium">{s.title}</h2>
        <p className="text-xs text-slate-400">{s.description(fieldCount)}</p>
        <Field label={s.fieldNameLabel}>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label={s.modeLabel}>
          <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as "single" | "multiple")}>
            <option value="single">{s.modeSingle}</option>
            <option value="multiple">{s.modeMultiple}</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1">{s.modeHint}</p>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className="text-sm border rounded-lg px-3 py-1.5 cursor-pointer" onClick={onCancel}>
            {s.cancel}
          </button>
          <button
            className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 cursor-pointer"
            onClick={() => onCreate({ label, mode })}
          >
            {s.create}
          </button>
        </div>
      </div>
    </div>
  );
}
