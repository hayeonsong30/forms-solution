"use client";

import { useState } from "react";
import type { FieldDTO, FieldType, RepeatGroupDTO } from "@/types";
import { CheckConfigPanel, Field, inputClass, NumberConfigPanel, PercentField, Section, TextConfigPanel } from "./configPanels";

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
}: {
  field: FieldDTO;
  otherCheckFields: FieldDTO[];
  onPatchLocal: (patch: Partial<FieldDTO>) => void;
  onSave: (body: Record<string, unknown>) => void;
  onSaveType: (type: FieldType) => void;
  onPatchConfig: <K extends "text" | "number" | "check">(key: K, patch: Partial<NonNullable<FieldDTO["config"][K]>>) => void;
  onAccept: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const [showPosition, setShowPosition] = useState(false);

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
            <option value="check">체크 판정</option>
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
      </Section>

      <Section title="위치·크기" collapsible collapsed={!showPosition} onToggle={() => setShowPosition((v) => !v)}>
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

export function GroupPropertiesPanel({
  group,
  onPatchLocal,
  onSave,
  onUngroup,
}: {
  group: RepeatGroupDTO;
  onPatchLocal: (patch: Partial<RepeatGroupDTO>) => void;
  onSave: (body: Record<string, unknown>) => void;
  onUngroup: () => void;
}) {
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
        <ul className="space-y-1">
          {group.columns.map((c) => (
            <li key={c.id} className="text-xs border rounded px-2 py-1 flex justify-between">
              <span>{c.label}</span>
              <span className="text-slate-400">
                {c.dataKey} · {c.type}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <div className="p-4">
        <button className="text-sm text-red-600 border border-red-200 rounded px-3 py-1 w-full" onClick={onUngroup}>
          반복행 해제 (첫 행 필드로 되돌리기)
        </button>
      </div>
    </div>
  );
}
