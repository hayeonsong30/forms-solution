"use client";

import { useState } from "react";
import { Field, inputClass } from "./configPanels";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    title: "반복행으로 묶기",
    description: (fieldCount: number) => `선택한 필드 ${fieldCount}개를 첫 행으로 하는 반복행 그룹을 만듭니다.`,
    groupNameLabel: "그룹명",
    maxRowsLabel: "최대 행 수",
    blankRowLabel: "빈 행 처리",
    blankRowExclude: "빈 행 제외",
    blankRowInclude: "빈 행 포함",
    useRowNumber: "행 번호 사용",
    cancel: "취소",
    create: "만들기",
  },
  ja: {
    title: "繰り返し行にまとめる",
    description: (fieldCount: number) => `選択した項目${fieldCount}個を1行目とする繰り返し行グループを作成します。`,
    groupNameLabel: "グループ名",
    maxRowsLabel: "最大行数",
    blankRowLabel: "空行の処理",
    blankRowExclude: "空行を除外",
    blankRowInclude: "空行を含める",
    useRowNumber: "行番号を使用",
    cancel: "キャンセル",
    create: "作成",
  },
} satisfies Record<Lang, unknown>;

export function CreateRepeatGroupModal({
  fieldCount,
  onCancel,
  onCreate,
}: {
  fieldCount: number;
  onCancel: () => void;
  onCreate: (opts: { label: string; maxRows: number; blankRowPolicy: "exclude" | "include"; useRowNumber: boolean }) => void;
}) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [label, setLabel] = useState(lang === "ko" ? "반복행" : "繰り返し行");
  const [maxRows, setMaxRows] = useState(25);
  const [blankRowPolicy, setBlankRowPolicy] = useState<"exclude" | "include">("exclude");
  const [useRowNumber, setUseRowNumber] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-96 p-5 space-y-3">
        <h2 className="font-medium">{s.title}</h2>
        <p className="text-xs text-slate-400">{s.description(fieldCount)}</p>
        <Field label={s.groupNameLabel}>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label={s.maxRowsLabel}>
          <input type="number" min={1} className={inputClass} value={maxRows} onChange={(e) => setMaxRows(Number(e.target.value))} />
        </Field>
        <Field label={s.blankRowLabel}>
          <select className={inputClass} value={blankRowPolicy} onChange={(e) => setBlankRowPolicy(e.target.value as "exclude" | "include")}>
            <option value="exclude">{s.blankRowExclude}</option>
            <option value="include">{s.blankRowInclude}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useRowNumber} onChange={(e) => setUseRowNumber(e.target.checked)} />
          {s.useRowNumber}
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button className="text-sm border rounded-lg px-3 py-1.5 cursor-pointer" onClick={onCancel}>
            {s.cancel}
          </button>
          <button
            className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 cursor-pointer"
            onClick={() => onCreate({ label, maxRows, blankRowPolicy, useRowNumber })}
          >
            {s.create}
          </button>
        </div>
      </div>
    </div>
  );
}
