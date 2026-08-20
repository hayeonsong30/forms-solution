"use client";

import { useState } from "react";
import { Field, inputClass } from "./configPanels";

export function MergeToChoiceModal({
  fieldCount,
  onCancel,
  onCreate,
}: {
  fieldCount: number;
  onCancel: () => void;
  onCreate: (opts: { label: string; mode: "single" | "multiple" }) => void;
}) {
  const [label, setLabel] = useState("선택");
  const [mode, setMode] = useState<"single" | "multiple">("single");

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-96 p-5 space-y-3">
        <h2 className="font-medium">선택 필드로 묶기</h2>
        <p className="text-xs text-slate-400">
          선택한 필드 {fieldCount}개를 각각 선택 옵션으로 하는 선택 필드 하나로 묶습니다. 각 필드의 위치는 그대로 옵션 판정 영역이
          되고, 원본 필드는 삭제됩니다.
        </p>
        <Field label="필드명">
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="선택 방식">
          <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as "single" | "multiple")}>
            <option value="single">단일 선택 (하나만 고를 수 있음)</option>
            <option value="multiple">다중 선택 (여러 개 고를 수 있음)</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            서로 배타적인 선택지가 아니라 각각 독립적으로 체크하는 항목(예: 여러 동의 확인)이라면 묶지 말고 개별 체크 필드로 두는
            것을 권장합니다.
          </p>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className="text-sm border rounded-lg px-3 py-1.5 cursor-pointer" onClick={onCancel}>
            취소
          </button>
          <button
            className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 cursor-pointer"
            onClick={() => onCreate({ label, mode })}
          >
            묶기
          </button>
        </div>
      </div>
    </div>
  );
}
