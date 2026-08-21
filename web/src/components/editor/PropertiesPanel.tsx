"use client";

import { useEffect, useState } from "react";
import type { ChoiceOptionDTO, FieldDTO, FieldType, RepeatGroupDTO } from "@/types";
import { MergeToChoiceModal } from "./MergeToChoiceModal";
import {
  CheckConfigPanel,
  ChoiceConfigPanel,
  DateConfigPanel,
  Field,
  inputClass,
  NumberConfigPanel,
  PercentField,
  Section,
  TextConfigPanel,
  TimeConfigPanel,
} from "./configPanels";

export type ChoiceOptionInput = { label: string; storedValue: string; region: { x: number; y: number; w: number; h: number } | null };

export function FieldPropertiesPanel({
  field,
  otherCheckFields,
  onPatchLocal,
  onSave,
  onSaveType,
  onPatchConfig,
  onAccept,
  onReject,
  onDelete,
  onSaveChoiceOptions,
  onArmOptionRegion,
  armedOptionIndex,
  onSplitChoice,
}: {
  field: FieldDTO;
  otherCheckFields: FieldDTO[];
  onPatchLocal: (patch: Partial<FieldDTO>) => void;
  onSave: (body: Record<string, unknown>) => void;
  onSaveType: (type: FieldType) => void;
  onPatchConfig: <K extends "text" | "number" | "check" | "date" | "time" | "choice">(
    key: K,
    patch: Partial<NonNullable<FieldDTO["config"][K]>>
  ) => void;
  onAccept: () => void;
  onReject: () => void;
  onDelete: () => void;
  onSaveChoiceOptions: (options: ChoiceOptionInput[]) => void;
  onArmOptionRegion: (optionIndex: number | null) => void;
  armedOptionIndex: number | null;
  onSplitChoice?: () => void;
}) {
  return (
    <div className="divide-y">
      <Section title="기본 정보">
        <Field label="필드명">
          <input
            className={inputClass}
            value={field.label}
            disabled={field.locked}
            onChange={(e) => onPatchLocal({ label: e.target.value })}
            onBlur={() => onSave({ label: field.label })}
          />
        </Field>
        <Field label="데이터 키">
          <input
            className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
            value={field.dataKey}
            disabled={field.locked}
            onChange={(e) => onPatchLocal({ dataKey: e.target.value })}
            onBlur={() => onSave({ dataKey: field.dataKey })}
          />
          <p className="text-[11px] text-slate-400 mt-1">편집 완료(인쇄 가능 전환) 전까지만 수정할 수 있습니다.</p>
        </Field>
        <Field label="데이터 유형">
          <select className={inputClass} value={field.type} disabled={field.locked} onChange={(e) => onSaveType(e.target.value as FieldType)}>
            <option value="text">텍스트</option>
            <option value="number">숫자</option>
            <option value="date">날짜</option>
            <option value="time">시간</option>
            <option value="check">체크 판정</option>
            <option value="choice">선택</option>
          </select>
        </Field>
        <Field label="설명">
          <textarea
            className={inputClass}
            rows={2}
            value={field.description ?? ""}
            onChange={(e) => onPatchLocal({ description: e.target.value })}
            onBlur={() => onSave({ description: field.description ?? "" })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => {
              onPatchLocal({ required: e.target.checked });
              onSave({ required: e.target.checked });
            }}
          />
          필수 필드
        </label>
        {field.status === "suggested" && (
          <div className="bg-violet-50 border border-violet-200 rounded p-2 space-y-2">
            <p className="text-xs text-violet-700">AI가 제안한 필드입니다. 검수 후 채택하거나 거부하세요.</p>
            <div className="flex gap-2">
              <button className="text-sm bg-violet-600 text-white rounded px-3 py-1 flex-1" onClick={onAccept}>
                채택
              </button>
              <button className="text-sm border border-violet-300 text-violet-700 rounded px-3 py-1 flex-1" onClick={onReject}>
                거부
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="유형별 설정">
        {field.type === "text" && <TextConfigPanel value={field.config.text} onChange={(patch) => onPatchConfig("text", patch)} />}
        {field.type === "number" && <NumberConfigPanel value={field.config.number} onChange={(patch) => onPatchConfig("number", patch)} />}
        {field.type === "check" && (
          <CheckConfigPanel value={field.config.check} otherCheckFields={otherCheckFields} onChange={(patch) => onPatchConfig("check", patch)} />
        )}
        {field.type === "date" && <DateConfigPanel value={field.config.date} onChange={(patch) => onPatchConfig("date", patch)} />}
        {field.type === "time" && <TimeConfigPanel value={field.config.time} onChange={(patch) => onPatchConfig("time", patch)} />}
        {field.type === "choice" && <ChoiceConfigPanel value={field.config.choice} onChange={(patch) => onPatchConfig("choice", patch)} />}
      </Section>

      {field.type === "choice" && (
        <Section title="선택 옵션">
          <ChoiceOptionsPanel
            fieldId={field.id}
            options={field.choiceOptions}
            onSave={onSaveChoiceOptions}
            onArmRegion={onArmOptionRegion}
            armedIndex={armedOptionIndex}
          />
          {onSplitChoice && field.choiceOptions.length > 0 && (
            <button
              className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-1.5 w-full text-slate-600 cursor-pointer mt-2"
              onClick={onSplitChoice}
            >
              선택 해제 (개별 체크 필드 {field.choiceOptions.length}개로 복원)
            </button>
          )}
        </Section>
      )}

      <Section title="위치·크기">
        <div className="grid grid-cols-2 gap-2">
          <PercentField label="X" value={field.boxX} onCommit={(v) => onSave({ box: { x: v, y: field.boxY, w: field.boxW, h: field.boxH } })} />
          <PercentField label="Y" value={field.boxY} onCommit={(v) => onSave({ box: { x: field.boxX, y: v, w: field.boxW, h: field.boxH } })} />
          <PercentField label="Width" value={field.boxW} onCommit={(v) => onSave({ box: { x: field.boxX, y: field.boxY, w: v, h: field.boxH } })} />
          <PercentField label="Height" value={field.boxH} onCommit={(v) => onSave({ box: { x: field.boxX, y: field.boxY, w: field.boxW, h: v } })} />
        </div>
        <Field label="페이지">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={field.pageNo}
            onChange={(e) => onPatchLocal({ pageNo: Number(e.target.value) })}
            onBlur={() => onSave({ pageNo: field.pageNo })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.locked}
            onChange={(e) => {
              onPatchLocal({ locked: e.target.checked });
              onSave({ locked: e.target.checked });
            }}
          />
          잠금 (위치·유형·데이터 키 변경 방지)
        </label>
      </Section>

      {field.type === "check" && (
        <Section title="검증">
          <Field label="교차 검증 (동시 true 불가 대상)">
            <select
              className={inputClass}
              value={field.config.check?.exclusiveWithFieldId ?? ""}
              onChange={(e) => onPatchConfig("check", { exclusiveWithFieldId: e.target.value || undefined })}
            >
              <option value="">없음</option>
              {otherCheckFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.dataKey})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">예: 합격/불합격 두 체크가 동시에 true면 검수 필요.</p>
          </Field>
        </Section>
      )}

      <div className="p-4">
        <button className="text-sm text-red-600 border border-red-200 rounded px-3 py-1 w-full" onClick={onDelete}>
          필드 삭제
        </button>
      </div>
    </div>
  );
}

// PRD_양식편집기_상세 §14.1 "선택 옵션별 판정 영역": 옵션마다 표시명·저장값·독립 좌표를 갖는다.
function ChoiceOptionsPanel({
  fieldId,
  options,
  onSave,
  onArmRegion,
  armedIndex,
}: {
  fieldId: string;
  options: ChoiceOptionDTO[];
  onSave: (options: ChoiceOptionInput[]) => void;
  onArmRegion: (optionIndex: number | null) => void;
  armedIndex: number | null;
}) {
  const [local, setLocal] = useState<ChoiceOptionInput[]>(() => toInput(options));

  // 선택된 필드가 바뀌면(다른 choice 필드를 클릭) 로컬 편집 상태를 그 필드 기준으로 되돌린다.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- field switch resets the local draft
  useEffect(() => setLocal(toInput(options)), [fieldId, options]);

  function commit(next: ChoiceOptionInput[]) {
    setLocal(next);
    onSave(next);
  }

  return (
    <div className="space-y-2">
      {local.map((o, i) => (
        <div key={i} className="border border-[var(--color-border)] rounded-lg p-2 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              className={`${inputClass} flex-1`}
              placeholder="표시명"
              value={o.label}
              onChange={(e) => setLocal((prev) => prev.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))}
              onBlur={() => commit(local)}
            />
            <input
              className={`${inputClass} flex-1`}
              placeholder="저장값"
              value={o.storedValue}
              onChange={(e) => setLocal((prev) => prev.map((x, xi) => (xi === i ? { ...x, storedValue: e.target.value } : x)))}
              onBlur={() => commit(local)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`text-xs rounded px-2 py-1 border cursor-pointer ${
                armedIndex === i ? "border-[var(--color-brand-600)] text-[var(--color-brand-600)] bg-[var(--color-brand-50)]" : "border-[var(--color-border)]"
              }`}
              onClick={() => onArmRegion(armedIndex === i ? null : i)}
            >
              {armedIndex === i ? "캔버스에서 드래그…" : o.region ? "영역 다시 지정" : "+ 영역 지정"}
            </button>
            <span className="text-[11px] text-slate-400">{o.region ? "영역 지정됨" : "영역 미지정"}</span>
            <button
              className="text-xs text-red-600 ml-auto cursor-pointer"
              onClick={() => commit(local.filter((_, xi) => xi !== i))}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
      <button
        className="text-sm border border-dashed border-[var(--color-border)] rounded-lg px-3 py-1.5 w-full text-slate-500 cursor-pointer"
        onClick={() => commit([...local, { label: `옵션 ${local.length + 1}`, storedValue: `option_${local.length + 1}`, region: null }])}
      >
        + 옵션 추가
      </button>
    </div>
  );
}

function toInput(options: ChoiceOptionDTO[]): ChoiceOptionInput[] {
  return options.map((o) => ({
    label: o.label,
    storedValue: o.storedValue,
    region:
      o.regionX !== null && o.regionY !== null && o.regionW !== null && o.regionH !== null
        ? { x: o.regionX, y: o.regionY, w: o.regionW, h: o.regionH }
        : null,
  }));
}

export function GroupPropertiesPanel({
  group,
  templateId,
  onPatchLocal,
  onSave,
  onUngroup,
  onColumnsChanged,
}: {
  group: RepeatGroupDTO;
  templateId: string;
  onPatchLocal: (patch: Partial<RepeatGroupDTO>) => void;
  onSave: (body: Record<string, unknown>) => void;
  onUngroup: () => void;
  onColumnsChanged: () => Promise<void>;
}) {
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  function toggleColumn(id: string) {
    setSelectedColumnIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function mergeColumnsToChoice(opts: { label: string; mode: "single" | "multiple" }) {
    await fetch(`/api/templates/${templateId}/repeat-groups/${group.id}/merge-to-choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnIds: selectedColumnIds, label: opts.label, mode: opts.mode }),
    });
    setSelectedColumnIds([]);
    setMergeModalOpen(false);
    await onColumnsChanged();
  }

  // "선택 컬럼으로 묶기"의 반대: 병합된 choice 컬럼을 옵션 판정 영역 기준으로 다시 개별 체크 컬럼으로 되돌린다.
  async function splitColumnToChecks(columnId: string) {
    const r = await fetch(`/api/templates/${templateId}/repeat-groups/${group.id}/columns/${columnId}/split-to-checks`, {
      method: "POST",
    });
    if (r.ok) await onColumnsChanged();
  }

  return (
    <div className="divide-y">
      <Section title="반복행 속성">
        <Field label="그룹명">
          <input className={inputClass} value={group.label} onChange={(e) => onPatchLocal({ label: e.target.value })} onBlur={() => onSave({ label: group.label })} />
        </Field>
        <Field label="그룹 데이터 키">
          <input
            className={inputClass}
            value={group.dataKey}
            onChange={(e) => onPatchLocal({ dataKey: e.target.value })}
            onBlur={() => onSave({ dataKey: group.dataKey })}
          />
        </Field>
        <Field label="최대 행 수">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={group.maxRows}
            onChange={(e) => onPatchLocal({ maxRows: Number(e.target.value) })}
            onBlur={() => onSave({ maxRows: group.maxRows })}
          />
        </Field>
        <Field label="빈 행 처리">
          <select
            className={inputClass}
            value={group.blankRowPolicy}
            onChange={(e) => {
              const blankRowPolicy = e.target.value as "exclude" | "include";
              onPatchLocal({ blankRowPolicy });
              onSave({ blankRowPolicy });
            }}
          >
            <option value="exclude">빈 행 제외</option>
            <option value="include">빈 행 포함</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={group.useRowNumber}
            onChange={(e) => {
              onPatchLocal({ useRowNumber: e.target.checked });
              onSave({ useRowNumber: e.target.checked });
            }}
          />
          행 번호 사용
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={group.allowDuplicate}
            onChange={(e) => {
              onPatchLocal({ allowDuplicate: e.target.checked });
              onSave({ allowDuplicate: e.target.checked });
            }}
          />
          중복 허용
        </label>
      </Section>
      <Section title="열 구성 (첫 행 기준, 좌→우)">
        <p className="text-xs text-slate-400 -mt-1 mb-1">
          2개 이상 체크하면 良/否처럼 여러 영역을 하나의 선택 값으로 묶을 수 있습니다.
        </p>
        <ul className="space-y-1">
          {group.columns.map((c) => (
            <li
              key={c.id}
              className={`text-xs border rounded px-2 py-1 flex items-center gap-2 cursor-pointer ${
                selectedColumnIds.includes(c.id) ? "border-teal-500 bg-teal-50" : ""
              }`}
              onClick={() => toggleColumn(c.id)}
            >
              <input type="checkbox" checked={selectedColumnIds.includes(c.id)} onChange={() => toggleColumn(c.id)} onClick={(e) => e.stopPropagation()} />
              <span className="flex-1">{c.label}</span>
              <span className="text-slate-400">
                {c.dataKey} · {c.type}
                {c.type === "choice" && c.choiceOptions.length > 0 ? ` (${c.choiceOptions.length})` : ""}
              </span>
              {c.type === "choice" && c.choiceOptions.length > 0 && (
                <button
                  className="text-slate-400 hover:text-teal-600 cursor-pointer underline shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    splitColumnToChecks(c.id);
                  }}
                  title={`개별 체크 컬럼 ${c.choiceOptions.length}개로 복원`}
                >
                  해제
                </button>
              )}
            </li>
          ))}
        </ul>
        {selectedColumnIds.length >= 2 && (
          <button
            className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 w-full cursor-pointer"
            onClick={() => setMergeModalOpen(true)}
          >
            선택 컬럼으로 묶기 ({selectedColumnIds.length})
          </button>
        )}
      </Section>
      {mergeModalOpen && (
        <MergeToChoiceModal fieldCount={selectedColumnIds.length} onCancel={() => setMergeModalOpen(false)} onCreate={mergeColumnsToChoice} />
      )}
      <Section title="행별 고정값 (PDF에 이미 인쇄된 값)">
        <p className="text-xs text-slate-400 -mt-1 mb-1">
          No.·항목명처럼 양식에 이미 인쇄돼 있어 OCR 대상이 아닌 값. 채워두면 CSV/JSON에 그대로 출력됩니다.
        </p>
        <FixedRowsEditor group={group} onSave={onSave} />
      </Section>
      <div className="p-4">
        <button className="text-sm text-red-600 border border-red-200 rounded px-3 py-1 w-full" onClick={onUngroup}>
          반복행 해제 (첫 행 필드로 되돌리기)
        </button>
      </div>
    </div>
  );
}

// PRD_반복행_기능_구현 §4.2/7 FixedRowValue — 행 인덱스별로 열 dataKey→값을 표로 입력한다.
// 로컬에서 자유롭게 편집하다가 "저장"을 눌러야 한 번에 PATCH한다(칸마다 요청 보내지 않음).
function FixedRowsEditor({
  group,
  onSave,
}: {
  group: RepeatGroupDTO;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const toGrid = (rows: RepeatGroupDTO["fixedRows"]) => {
    const grid: Record<number, Record<string, string>> = {};
    for (const r of rows ?? []) grid[r.rowIndex] = { ...r.values };
    return grid;
  };
  const [grid, setGrid] = useState(() => toGrid(group.fixedRows));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setGrid(toGrid(group.fixedRows));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- group.id가 바뀔 때만(다른 그룹 선택 시) 로컬 편집분을 리셋
  }, [group.id]);

  function setCell(rowIndex: number, dataKey: string, value: string) {
    setGrid((g) => ({ ...g, [rowIndex]: { ...g[rowIndex], [dataKey]: value } }));
    setDirty(true);
  }

  function save() {
    const fixedRows = Object.entries(grid)
      .map(([rowIndex, values]) => ({
        rowIndex: Number(rowIndex),
        values: Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== "")),
      }))
      .filter((r) => Object.keys(r.values).length > 0);
    onSave({ fixedRows });
    setDirty(false);
  }

  return (
    <div className="space-y-2">
      <div className="max-h-64 overflow-auto border rounded">
        <table className="text-xs w-full">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left font-medium w-10">행</th>
              {group.columns.map((c) => (
                <th key={c.id} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: group.maxRows }, (_, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                {group.columns.map((c) => (
                  <td key={c.id} className="px-1 py-0.5">
                    <input
                      className="w-full text-xs px-1.5 py-1 border rounded outline-none focus:border-teal-500"
                      value={grid[i]?.[c.dataKey] ?? ""}
                      onChange={(e) => setCell(i, c.dataKey, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 w-full disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        disabled={!dirty}
        onClick={save}
      >
        고정값 저장
      </button>
    </div>
  );
}
