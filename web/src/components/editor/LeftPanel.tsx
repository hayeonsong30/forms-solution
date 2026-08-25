"use client";

import { useState } from "react";
import type { FieldDTO, FieldType, RepeatGroupDTO } from "@/types";
import { useLanguage, type Lang } from "@/lib/language";

const TYPE_ICON: Record<FieldType, string> = { text: "T", number: "#", check: "✓", date: "日", time: "時", choice: "●" };
const TYPE_LABEL = {
  ko: {
    text: "텍스트",
    number: "숫자",
    check: "체크 판정",
    date: "날짜",
    time: "시간",
    choice: "선택",
  },
  ja: {
    text: "テキスト",
    number: "数値",
    check: "チェック判定",
    date: "日付",
    time: "時刻",
    choice: "選択",
  },
} satisfies Record<Lang, Record<FieldType, string>>;
const ADD_TYPES: FieldType[] = ["text", "number", "date", "time", "check", "choice"];

const STRINGS = {
  ko: {
    add: "ADD",
    addHint: "카드를 캔버스로 드래그하거나 클릭 후 캔버스를 클릭하세요.",
    searchPlaceholder: "필드명 또는 데이터 키",
    page1: "1페이지",
    repeatTag: "Repeat",
    lock: "잠금",
    toggleVisibility: "표시·숨김",
    delete: "삭제",
    noFieldsYet: "아직 필드가 없습니다.",
  },
  ja: {
    add: "追加",
    addHint: "カードをキャンバスへドラッグするか、クリック後にキャンバスをクリックしてください。",
    searchPlaceholder: "フィールド名またはデータキー",
    page1: "1ページ目",
    repeatTag: "Repeat",
    lock: "ロック",
    toggleVisibility: "表示・非表示",
    delete: "削除",
    noFieldsYet: "まだフィールドがありません。",
  },
} satisfies Record<
  Lang,
  {
    add: string;
    addHint: string;
    searchPlaceholder: string;
    page1: string;
    repeatTag: string;
    lock: string;
    toggleVisibility: string;
    delete: string;
    noFieldsYet: string;
  }
>;

export function LeftPanel({
  disabled,
  fields,
  repeatGroups,
  selectedId,
  selectedGroupId,
  onSelectField,
  onSelectGroup,
  onToggleHidden,
  onToggleLocked,
  onDeleteField,
  onArmAdd,
  armedType,
  onDragCardStart,
}: {
  disabled: boolean;
  fields: FieldDTO[];
  repeatGroups: RepeatGroupDTO[];
  selectedId: string | null;
  selectedGroupId: string | null;
  onSelectField: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onToggleHidden: (field: FieldDTO) => void;
  onToggleLocked: (field: FieldDTO) => void;
  onDeleteField: (field: FieldDTO) => void;
  onArmAdd: (type: FieldType | null) => void;
  armedType: FieldType | null;
  onDragCardStart: (type: FieldType) => void;
}) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const typeLabel = TYPE_LABEL[lang];
  const [query, setQuery] = useState("");

  const filteredFields = fields.filter(
    (f) => f.label.toLowerCase().includes(query.toLowerCase()) || f.dataKey.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-[var(--color-border)] flex flex-col overflow-hidden">
      <div className="p-3 border-b border-[var(--color-border)]">
        <div className="text-xs font-medium text-slate-400 mb-2 px-1">{s.add}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {ADD_TYPES.map((type) => (
            <button
              key={type}
              draggable={!disabled}
              onDragStart={() => onDragCardStart(type)}
              onClick={() => onArmAdd(armedType === type ? null : type)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 ${
                armedType === type
                  ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                  : "border-[var(--color-border)] hover:bg-slate-50"
              }`}
            >
              <span className="text-sm font-semibold">{TYPE_ICON[type]}</span>
              {typeLabel[type]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">{s.addHint}</p>
      </div>

      <div className="p-3 border-b border-[var(--color-border)]">
        <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs">
          <span className="text-slate-400">⌕</span>
          <input
            className="flex-1 outline-none"
            placeholder={s.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-2 py-1 text-[11px] font-medium text-slate-400 flex items-center justify-between">
          <span>{s.page1}</span>
          <span>{fields.length + repeatGroups.length}</span>
        </div>
        {repeatGroups.map((g) => (
          <div key={g.id}>
            <button
              onClick={() => onSelectGroup(g.id)}
              className={`w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-left ${
                g.id === selectedGroupId ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]" : "hover:bg-slate-50"
              }`}
            >
              <span className="text-teal-600">↻</span>
              <span className="flex-1 truncate">{g.label}</span>
              <span className="text-slate-400">{s.repeatTag}</span>
            </button>
            <div className="ml-5 border-l border-[var(--color-border)] pl-2">
              {g.columns.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400">
                  <span>{TYPE_ICON[c.type]}</span>
                  <span className="flex-1 truncate">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredFields.map((f) => (
          <div
            key={f.id}
            className={`group flex items-center gap-1.5 rounded px-2 py-1.5 text-xs cursor-pointer ${
              f.id === selectedId ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]" : "hover:bg-slate-50"
            }`}
            onClick={() => onSelectField(f.id)}
          >
            <span className={f.status === "suggested" ? "text-violet-500" : "text-slate-400"}>{TYPE_ICON[f.type]}</span>
            <span className="flex-1 truncate">{f.label}</span>
            {f.status === "suggested" && <span className="text-[10px] text-violet-500">AI</span>}
            <button
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLocked(f);
              }}
              title={s.lock}
            >
              {f.locked ? "🔒" : "🔓"}
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHidden(f);
              }}
              title={s.toggleVisibility}
            >
              {f.hidden ? "␣" : "👁"}
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteField(f);
              }}
              title={s.delete}
            >
              ✕
            </button>
          </div>
        ))}
        {fields.length === 0 && repeatGroups.length === 0 && (
          <p className="text-xs text-slate-400 px-2 py-4">{s.noFieldsYet}</p>
        )}
      </div>
    </aside>
  );
}
