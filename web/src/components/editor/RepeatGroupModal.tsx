"use client";

import { useState } from "react";
import { Field, inputClass } from "./configPanels";

export function CreateRepeatGroupModal({
  fieldCount,
  onCancel,
  onCreate,
}: {
  fieldCount: number;
  onCancel: () => void;
  onCreate: (opts: { label: string; maxRows: number; blankRowPolicy: "exclude" | "include"; useRowNumber: boolean }) => void;
}) {
  const [label, setLabel] = useState("반복행");
  const [maxRows, setMaxRows] = useState(25);
  const [blankRowPolicy, setBlankRowPolicy] = useState<"exclude" | "include">("exclude");
  const [useRowNumber, setUseRowNumber] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-96 p-5 space-y-3">
        <h2 className="font-medium">반복행으로 묶기</h2>
        <p className="text-xs text-slate-400">선택한 필드 {fieldCount}개를 첫 행으로 하는 반복행 그룹을 만듭니다.</p>
        <Field label="그룹명">
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="최대 행 수">
          <input type="number" min={1} className={inputClass} value={maxRows} onChange={(e) => setMaxRows(Number(e.target.value))} />
        </Field>
        <Field label="빈 행 처리">
          <select className={inputClass} value={blankRowPolicy} onChange={(e) => setBlankRowPolicy(e.target.value as "exclude" | "include")}>
            <option value="exclude">빈 행 제외</option>
            <option value="include">빈 행 포함</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useRowNumber} onChange={(e) => setUseRowNumber(e.target.checked)} />
          행 번호 사용
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button className="text-sm border rounded-lg px-3 py-1.5 cursor-pointer" onClick={onCancel}>
            취소
          </button>
          <button
            className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 cursor-pointer"
            onClick={() => onCreate({ label, maxRows, blankRowPolicy, useRowNumber })}
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  );
}
