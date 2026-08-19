"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import type {
  CheckConfig,
  FieldDTO,
  FieldIssue,
  FieldType,
  NumberConfig,
  RepeatGroupDTO,
  TemplateDetailResponse,
  TextConfig,
} from "@/types";

const PAGE_RATIO = 297 / 210; // A4 세로 비율 (h/w)
const DEFAULT_BOX = { w: 0.16, h: 0.04 };

type Tool = { mode: "select" } | { mode: "add"; type: FieldType };

export default function EditorPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);

  const [data, setData] = useState<TemplateDetailResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [multiSelectIds, setMultiSelectIds] = useState<string[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [tool, setTool] = useState<Tool>({ mode: "select" });
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPosition, setShowPosition] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}`);
    if (res.ok) setData(await res.json());
  }, [templateId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  const fields = data?.fields ?? [];
  const repeatGroups = data?.repeatGroups ?? [];
  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const selectedGroup = repeatGroups.find((g) => g.id === selectedGroupId) ?? null;
  const otherCheckFields = fields.filter((f) => f.type === "check" && f.id !== selectedId);

  function patchLocalField(id: string, patch: Partial<FieldDTO>) {
    setData((d) => (d ? { ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : d));
  }

  async function saveField(id: string, body: Record<string, unknown>) {
    await fetch(`/api/templates/${templateId}/fields/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function saveBox(id: string, box: { x: number; y: number; w: number; h: number }) {
    await saveField(id, { box });
  }

  function patchConfig<K extends "text" | "number" | "check">(
    field: FieldDTO,
    key: K,
    patch: Partial<NonNullable<FieldDTO["config"][K]>>
  ) {
    const nextSection = { ...(field.config[key] ?? {}), ...patch };
    patchLocalField(field.id, { config: { ...field.config, [key]: nextSection } });
    saveField(field.id, { config: { [key]: patch } });
  }

  async function createField(x: number, y: number, type: FieldType) {
    const box = {
      x: clamp(x - DEFAULT_BOX.w / 2, 0, 1 - DEFAULT_BOX.w),
      y: clamp(y - DEFAULT_BOX.h / 2, 0, 1 - DEFAULT_BOX.h),
      w: DEFAULT_BOX.w,
      h: DEFAULT_BOX.h,
    };
    const res = await fetch(`/api/templates/${templateId}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageNo: 1,
        label: type === "text" ? "새 텍스트 필드" : type === "number" ? "새 숫자 필드" : "새 체크 필드",
        type,
        box,
        required: false,
      }),
    });
    if (res.ok) {
      const field: FieldDTO = await res.json();
      await load();
      setSelectedId(field.id);
      setTool({ mode: "select" });
    }
  }

  function patchLocalGroup(id: string, patch: Partial<RepeatGroupDTO>) {
    setData((d) => (d ? { ...d, repeatGroups: d.repeatGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)) } : d));
  }

  async function saveGroup(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/templates/${templateId}/repeat-groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) patchLocalGroup(id, await res.json());
  }

  function selectField(id: string, shiftKey: boolean) {
    setSelectedGroupId(null);
    if (shiftKey) {
      setSelectedId(null);
      setMultiSelectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      return;
    }
    setMultiSelectIds([]);
    setSelectedId(id);
  }

  function selectGroup(id: string) {
    setSelectedId(null);
    setMultiSelectIds([]);
    setSelectedGroupId(id);
  }

  async function createRepeatGroup(opts: {
    label: string;
    maxRows: number;
    blankRowPolicy: "exclude" | "include";
    useRowNumber: boolean;
  }) {
    const res = await fetch(`/api/templates/${templateId}/repeat-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...opts, fieldIds: multiSelectIds }),
    });
    if (res.ok) {
      const group = await res.json();
      setMultiSelectIds([]);
      setGroupModalOpen(false);
      await load();
      setSelectedGroupId(group.id);
    } else {
      const json = await res.json();
      setActionError(json.error === "FIELDS_MUST_SHARE_PAGE" ? "같은 페이지의 필드만 묶을 수 있습니다." : "반복행 생성 실패");
    }
  }

  async function ungroupSelected() {
    if (!selectedGroup) return;
    const res = await fetch(`/api/templates/${templateId}/repeat-groups/${selectedGroup.id}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedGroupId(null);
      await load();
    }
  }

  function startGroupDrag(group: RepeatGroupDTO, e: React.PointerEvent) {
    e.stopPropagation();
    if (!canvasRef.current) return;
    selectGroup(group.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: group.areaX, y: group.areaY };

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      patchLocalGroup(group.id, {
        areaX: clamp(start.x + dx, 0, 1 - group.areaW),
        areaY: clamp(start.y + dy, 0, 1 - group.areaH),
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const g = data?.repeatGroups.find((x) => x.id === group.id);
      if (g) saveGroup(group.id, { area: { x: g.areaX, y: g.areaY, w: g.areaW } });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function deleteSelected() {
    if (!selected) return;
    const res = await fetch(`/api/templates/${templateId}/fields/${selected.id}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedId(null);
      await load();
    } else if (res.status === 409) {
      setActionError("잠긴 필드는 삭제할 수 없습니다.");
    }
  }

  async function runValidate() {
    const res = await fetch(`/api/templates/${templateId}/validate`, { method: "POST" });
    const json = await res.json();
    setIssues(json.issues ?? []);
  }

  async function activate() {
    setActionError(null);
    const res = await fetch(`/api/templates/${templateId}/activate`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setIssues(json.issues ?? []);
      setActionError(json.template?.printableReason ?? "인쇄 가능 전환 실패");
      return;
    }
    setIssues([]);
    await load();
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (tool.mode !== "add") {
      if (!canvasRef.current) return;
      setSelectedId(null);
      setSelectedGroupId(null);
      if (!e.shiftKey) setMultiSelectIds([]);
      return;
    }
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    createField(x, y, tool.type);
  }

  function startDrag(field: FieldDTO, e: React.PointerEvent, mode: "move" | "resize") {
    e.stopPropagation();
    if (field.locked || !canvasRef.current) return;
    setSelectedId(field.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: field.boxX, y: field.boxY, w: field.boxW, h: field.boxH };

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "move") {
        patchLocalField(field.id, {
          boxX: clamp(start.x + dx, 0, 1 - start.w),
          boxY: clamp(start.y + dy, 0, 1 - start.h),
        });
      } else {
        patchLocalField(field.id, {
          boxW: clamp(start.w + dx, 0.02, 1 - start.x),
          boxH: clamp(start.h + dy, 0.02, 1 - start.y),
        });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const f = data?.fields.find((x) => x.id === field.id);
      if (f) saveBox(field.id, { x: f.boxX, y: f.boxY, w: f.boxW, h: f.boxH });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!data) return <main className="p-8 text-sm text-gray-500">불러오는 중…</main>;

  return (
    <main className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <header className="border-b px-4 py-2 flex items-center gap-2">
          <h1 className="font-semibold mr-4">{data.template.name}</h1>
          <ToolButton active={tool.mode === "select"} onClick={() => setTool({ mode: "select" })}>
            선택
          </ToolButton>
          <ToolButton
            active={tool.mode === "add" && tool.type === "text"}
            onClick={() => setTool({ mode: "add", type: "text" })}
          >
            + 텍스트
          </ToolButton>
          <ToolButton
            active={tool.mode === "add" && tool.type === "number"}
            onClick={() => setTool({ mode: "add", type: "number" })}
          >
            + 숫자
          </ToolButton>
          <ToolButton
            active={tool.mode === "add" && tool.type === "check"}
            onClick={() => setTool({ mode: "add", type: "check" })}
          >
            + 체크
          </ToolButton>
          {multiSelectIds.length > 0 && (
            <button
              className="text-sm bg-teal-600 text-white rounded px-3 py-1"
              onClick={() => setGroupModalOpen(true)}
            >
              반복행으로 묶기 ({multiSelectIds.length})
            </button>
          )}
          <div className="flex-1" />
          <button className="text-sm border rounded px-3 py-1" onClick={runValidate}>
            검사
          </button>
          <button className="text-sm bg-blue-600 text-white rounded px-3 py-1" onClick={activate}>
            인쇄 가능으로 전환
          </button>
          <span className="text-xs text-gray-500 ml-2">
            {data.template.printable ? "✅ 인쇄 가능" : `⏸ ${data.template.printableReason ?? "편집 중"}`}
          </span>
        </header>

        {(issues.length > 0 || actionError) && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
            {actionError && <div>{actionError}</div>}
            {issues.map((i, idx) => (
              <div key={idx}>{i.message}</div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="relative bg-white shadow mx-auto"
            style={{ width: 640, height: 640 * PAGE_RATIO, cursor: tool.mode === "add" ? "crosshair" : "default" }}
          >
            {repeatGroups.map((g) => (
              <div
                key={g.id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectGroup(g.id);
                }}
                onPointerDown={(e) => startGroupDrag(g, e)}
                className={`absolute border-2 overflow-hidden select-none ${
                  g.id === selectedGroupId ? "border-teal-600 bg-teal-50/40" : "border-teal-400 bg-teal-50/20"
                }`}
                style={{
                  left: `${g.areaX * 100}%`,
                  top: `${g.areaY * 100}%`,
                  width: `${g.areaW * 100}%`,
                  height: `${g.areaH * 100}%`,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${
                    (g.rowHeight / g.areaH) * 100 - 0.3
                  }%, rgba(13,148,136,0.4) ${(g.rowHeight / g.areaH) * 100 - 0.3}%, rgba(13,148,136,0.4) ${
                    (g.rowHeight / g.areaH) * 100
                  }%)`,
                }}
              >
                <span className="absolute -top-5 left-0 text-[10px] text-teal-700 bg-white/80 px-1">
                  {g.label} × {g.maxRows}
                </span>
              </div>
            ))}
            {fields.map((f) => (
              <div
                key={f.id}
                onClick={(e) => selectField(f.id, e.shiftKey)}
                onPointerDown={(e) => startDrag(f, e, "move")}
                className={`absolute border-2 text-[10px] px-1 overflow-hidden select-none ${
                  multiSelectIds.includes(f.id)
                    ? "border-amber-500 bg-amber-50/70"
                    : f.id === selectedId
                      ? "border-blue-600 bg-blue-50/70"
                      : f.status === "suggested"
                        ? "border-dashed border-violet-500 bg-violet-50/50"
                        : "border-slate-400 bg-white/60"
                }`}
                style={{
                  left: `${f.boxX * 100}%`,
                  top: `${f.boxY * 100}%`,
                  width: `${f.boxW * 100}%`,
                  height: `${f.boxH * 100}%`,
                }}
              >
                {f.label}
                {f.id === selectedId && !f.locked && (
                  <div
                    onPointerDown={(e) => startDrag(f, e, "resize")}
                    className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-600 cursor-se-resize"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="w-80 border-l overflow-y-auto">
        {!selected && !selectedGroup && <p className="p-4 text-sm text-gray-500">필드를 선택하세요.</p>}
        {selectedGroup && (
          <div className="divide-y">
            <Section title="반복행 속성">
              <Field label="그룹명">
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={selectedGroup.label}
                  onChange={(e) => patchLocalGroup(selectedGroup.id, { label: e.target.value })}
                  onBlur={() => saveGroup(selectedGroup.id, { label: selectedGroup.label })}
                />
              </Field>
              <Field label="그룹 데이터 키">
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={selectedGroup.dataKey}
                  onChange={(e) => patchLocalGroup(selectedGroup.id, { dataKey: e.target.value })}
                  onBlur={() => saveGroup(selectedGroup.id, { dataKey: selectedGroup.dataKey })}
                />
              </Field>
              <Field label="최대 행 수">
                <input
                  type="number"
                  min={1}
                  className="border rounded px-2 py-1 w-full"
                  value={selectedGroup.maxRows}
                  onChange={(e) => patchLocalGroup(selectedGroup.id, { maxRows: Number(e.target.value) })}
                  onBlur={() => saveGroup(selectedGroup.id, { maxRows: selectedGroup.maxRows })}
                />
              </Field>
              <Field label="빈 행 처리">
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={selectedGroup.blankRowPolicy}
                  onChange={(e) => {
                    const blankRowPolicy = e.target.value as "exclude" | "include";
                    patchLocalGroup(selectedGroup.id, { blankRowPolicy });
                    saveGroup(selectedGroup.id, { blankRowPolicy });
                  }}
                >
                  <option value="exclude">빈 행 제외</option>
                  <option value="include">빈 행 포함</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedGroup.useRowNumber}
                  onChange={(e) => {
                    patchLocalGroup(selectedGroup.id, { useRowNumber: e.target.checked });
                    saveGroup(selectedGroup.id, { useRowNumber: e.target.checked });
                  }}
                />
                행 번호 사용
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedGroup.allowDuplicate}
                  onChange={(e) => {
                    patchLocalGroup(selectedGroup.id, { allowDuplicate: e.target.checked });
                    saveGroup(selectedGroup.id, { allowDuplicate: e.target.checked });
                  }}
                />
                중복 허용
              </label>
            </Section>
            <Section title="열 구성 (첫 행 기준, 좌→우)">
              <ul className="space-y-1">
                {selectedGroup.columns.map((c) => (
                  <li key={c.id} className="text-xs border rounded px-2 py-1 flex justify-between">
                    <span>{c.label}</span>
                    <span className="text-gray-400">
                      {c.dataKey} · {c.type}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
            <div className="p-4">
              <button className="text-sm text-red-600 border border-red-200 rounded px-3 py-1 w-full" onClick={ungroupSelected}>
                반복행 해제 (첫 행 필드로 되돌리기)
              </button>
            </div>
          </div>
        )}
        {selected && (
          <div className="divide-y">
            <Section title="기본 정보">
              <Field label="필드명">
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={selected.label}
                  disabled={selected.locked}
                  onChange={(e) => patchLocalField(selected.id, { label: e.target.value })}
                  onBlur={() => saveField(selected.id, { label: selected.label })}
                />
              </Field>
              <Field label="데이터 키">
                <input
                  className="border rounded px-2 py-1 w-full disabled:bg-gray-50 disabled:text-gray-400"
                  value={selected.dataKey}
                  disabled={selected.locked}
                  onChange={(e) => patchLocalField(selected.id, { dataKey: e.target.value })}
                  onBlur={() => saveField(selected.id, { dataKey: selected.dataKey })}
                />
                <p className="text-[11px] text-gray-400 mt-1">편집 완료(인쇄 가능 전환) 전까지만 수정할 수 있습니다.</p>
              </Field>
              <Field label="데이터 유형">
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={selected.type}
                  disabled={selected.locked}
                  onChange={(e) => {
                    const type = e.target.value as FieldType;
                    saveField(selected.id, { type }).then(load);
                  }}
                >
                  <option value="text">텍스트</option>
                  <option value="number">숫자</option>
                  <option value="check">체크 판정</option>
                </select>
              </Field>
              <Field label="설명">
                <textarea
                  className="border rounded px-2 py-1 w-full"
                  rows={2}
                  value={selected.description ?? ""}
                  onChange={(e) => patchLocalField(selected.id, { description: e.target.value })}
                  onBlur={() => saveField(selected.id, { description: selected.description ?? "" })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.required}
                  onChange={(e) => {
                    patchLocalField(selected.id, { required: e.target.checked });
                    saveField(selected.id, { required: e.target.checked });
                  }}
                />
                필수 필드
              </label>
            </Section>

            <Section title="유형별 설정">
              {selected.type === "text" && (
                <TextConfigPanel value={selected.config.text} onChange={(patch) => patchConfig(selected, "text", patch)} />
              )}
              {selected.type === "number" && (
                <NumberConfigPanel
                  value={selected.config.number}
                  onChange={(patch) => patchConfig(selected, "number", patch)}
                />
              )}
              {selected.type === "check" && (
                <CheckConfigPanel
                  value={selected.config.check}
                  otherCheckFields={otherCheckFields}
                  onChange={(patch) => patchConfig(selected, "check", patch)}
                />
              )}
            </Section>

            <Section
              title="위치·크기"
              collapsible
              collapsed={!showPosition}
              onToggle={() => setShowPosition((v) => !v)}
            >
              <div className="grid grid-cols-2 gap-2">
                <PercentField
                  label="X"
                  value={selected.boxX}
                  onCommit={(v) => saveBox(selected.id, { x: v, y: selected.boxY, w: selected.boxW, h: selected.boxH })}
                />
                <PercentField
                  label="Y"
                  value={selected.boxY}
                  onCommit={(v) => saveBox(selected.id, { x: selected.boxX, y: v, w: selected.boxW, h: selected.boxH })}
                />
                <PercentField
                  label="Width"
                  value={selected.boxW}
                  onCommit={(v) => saveBox(selected.id, { x: selected.boxX, y: selected.boxY, w: v, h: selected.boxH })}
                />
                <PercentField
                  label="Height"
                  value={selected.boxH}
                  onCommit={(v) => saveBox(selected.id, { x: selected.boxX, y: selected.boxY, w: selected.boxW, h: v })}
                />
              </div>
              <Field label="페이지">
                <input
                  type="number"
                  min={1}
                  className="border rounded px-2 py-1 w-full"
                  value={selected.pageNo}
                  onChange={(e) => patchLocalField(selected.id, { pageNo: Number(e.target.value) })}
                  onBlur={() => saveField(selected.id, { pageNo: selected.pageNo })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.locked}
                  onChange={(e) => {
                    patchLocalField(selected.id, { locked: e.target.checked });
                    saveField(selected.id, { locked: e.target.checked });
                  }}
                />
                잠금 (위치·유형·데이터 키 변경 방지)
              </label>
            </Section>

            {selected.type === "check" && (
              <Section title="검증">
                <Field label="교차 검증 (동시 true 불가 대상)">
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={selected.config.check?.exclusiveWithFieldId ?? ""}
                    onChange={(e) => patchConfig(selected, "check", { exclusiveWithFieldId: e.target.value || undefined })}
                  >
                    <option value="">없음</option>
                    {otherCheckFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label} ({f.dataKey})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">예: 합격/불합격 두 체크가 동시에 true면 검수 필요.</p>
                </Field>
              </Section>
            )}

            <div className="p-4">
              <button className="text-sm text-red-600 border border-red-200 rounded px-3 py-1 w-full" onClick={deleteSelected}>
                필드 삭제
              </button>
            </div>
          </div>
        )}
      </aside>

      {groupModalOpen && (
        <CreateRepeatGroupModal
          fieldCount={multiSelectIds.length}
          onCancel={() => setGroupModalOpen(false)}
          onCreate={createRepeatGroup}
        />
      )}
    </main>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

function ToolButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm rounded px-3 py-1 border ${active ? "bg-slate-800 text-white border-slate-800" : "border-gray-300"}`}
    >
      {children}
    </button>
  );
}

function Section({
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
        {collapsible && <span className="text-gray-400">{collapsed ? "▸" : "▾"}</span>}
      </button>
      {(!collapsible || !collapsed) && <div className="space-y-3 text-sm">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function PercentField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState((value * 100).toFixed(1));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local edit buffer when box changes externally (drag)
    setLocal((value * 100).toFixed(1));
  }, [value]);
  return (
    <Field label={`${label} (%)`}>
      <input
        type="number"
        step={0.1}
        className="border rounded px-2 py-1 w-full"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = Number(local);
          if (!Number.isNaN(n)) onCommit(clamp(n / 100, 0, 1));
        }}
      />
    </Field>
  );
}

function TextConfigPanel({ value, onChange }: { value?: TextConfig; onChange: (p: Partial<TextConfig>) => void }) {
  const v = value ?? ({} as TextConfig);
  return (
    <>
      <Field label="작성 형태">
        <select
          className="border rounded px-2 py-1 w-full"
          value={v.writingMode ?? "single"}
          onChange={(e) => onChange({ writingMode: e.target.value as TextConfig["writingMode"] })}
        >
          <option value="single">한 줄</option>
          <option value="multiline">여러 줄</option>
        </select>
      </Field>
      <Field label="인식 언어">
        <select
          className="border rounded px-2 py-1 w-full"
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
          className="border rounded px-2 py-1 w-full"
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
          <input
            className="border rounded px-2 py-1 w-full"
            defaultValue={v.customPattern ?? ""}
            onBlur={(e) => onChange({ customPattern: e.target.value })}
          />
        </Field>
      )}
      <Field label="최대 길이">
        <input
          type="number"
          min={1}
          className="border rounded px-2 py-1 w-full"
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

function NumberConfigPanel({ value, onChange }: { value?: NumberConfig; onChange: (p: Partial<NumberConfig>) => void }) {
  const v = value ?? ({} as NumberConfig);
  return (
    <>
      <Field label="숫자 형식">
        <select
          className="border rounded px-2 py-1 w-full"
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
            className="border rounded px-2 py-1 w-full"
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
            className="border rounded px-2 py-1 w-full"
            defaultValue={v.min ?? ""}
            onBlur={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="최대">
          <input
            type="number"
            className="border rounded px-2 py-1 w-full"
            defaultValue={v.max ?? ""}
            onBlur={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>
      <Field label="단위">
        <input
          className="border rounded px-2 py-1 w-full"
          placeholder="예: kg, 個"
          defaultValue={v.unit ?? ""}
          onBlur={(e) => onChange({ unit: e.target.value || undefined })}
        />
      </Field>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={v.thousandsSeparator ?? false}
          onChange={(e) => onChange({ thousandsSeparator: e.target.checked })}
        />
        천 단위 구분 허용
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.allowBlank ?? true} onChange={(e) => onChange({ allowBlank: e.target.checked })} />
        빈칸 허용
      </label>
    </>
  );
}

function CheckConfigPanel({
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
          className="border rounded px-2 py-1 w-full"
          value={v.mode ?? "symbol_classification"}
          onChange={(e) => onChange({ mode: e.target.value as CheckConfig["mode"] })}
        >
          <option value="presence">체크 유무</option>
          <option value="symbol_classification">true/false 기호</option>
        </select>
      </Field>
      <Field label="true 표시 (쉼표 구분)">
        <input
          className="border rounded px-2 py-1 w-full"
          defaultValue={(v.trueMarks ?? ["CHECK", "V"]).join(", ")}
          onBlur={(e) => onChange({ trueMarks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
      {v.mode === "symbol_classification" && (
        <Field label="false 표시 (쉼표 구분)">
          <input
            className="border rounded px-2 py-1 w-full"
            defaultValue={(v.falseMarks ?? ["X"]).join(", ")}
            onBlur={(e) => onChange({ falseMarks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
      )}
      <Field label="빈칸 처리">
        <select
          className="border rounded px-2 py-1 w-full"
          value={v.blankValue ?? "null"}
          onChange={(e) => onChange({ blankValue: e.target.value as CheckConfig["blankValue"] })}
        >
          <option value="null">null (미기재로 간주)</option>
          <option value="false">false</option>
          <option value="required_error">필수 오류</option>
        </select>
      </Field>
      <Field label="애매한 표시">
        <select
          className="border rounded px-2 py-1 w-full"
          value={v.ambiguousPolicy ?? "always_review"}
          onChange={(e) => onChange({ ambiguousPolicy: e.target.value as CheckConfig["ambiguousPolicy"] })}
        >
          <option value="always_review">항상 검수</option>
          <option value="nearest_guess">가장 가까운 값 추천</option>
        </select>
      </Field>
      <Field label="선택 영역">
        <select
          className="border rounded px-2 py-1 w-full"
          value={v.regionMode ?? "box"}
          onChange={(e) => onChange({ regionMode: e.target.value as CheckConfig["regionMode"] })}
        >
          <option value="box">박스 내부</option>
          <option value="full_area">영역 전체</option>
        </select>
      </Field>
      {otherCheckFields.length === 0 && (
        <p className="text-[11px] text-gray-400">체크 필드가 하나 더 있으면 검증 섹션에서 교차 검증을 설정할 수 있습니다.</p>
      )}
    </>
  );
}

function CreateRepeatGroupModal({
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
      <div className="bg-white rounded shadow-lg w-96 p-5 space-y-3">
        <h2 className="font-medium">반복행으로 묶기</h2>
        <p className="text-xs text-gray-500">선택한 필드 {fieldCount}개를 첫 행으로 하는 반복행 그룹을 만듭니다.</p>
        <Field label="그룹명">
          <input className="border rounded px-2 py-1 w-full" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="최대 행 수">
          <input
            type="number"
            min={1}
            className="border rounded px-2 py-1 w-full"
            value={maxRows}
            onChange={(e) => setMaxRows(Number(e.target.value))}
          />
        </Field>
        <Field label="빈 행 처리">
          <select
            className="border rounded px-2 py-1 w-full"
            value={blankRowPolicy}
            onChange={(e) => setBlankRowPolicy(e.target.value as "exclude" | "include")}
          >
            <option value="exclude">빈 행 제외</option>
            <option value="include">빈 행 포함</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useRowNumber} onChange={(e) => setUseRowNumber(e.target.checked)} />
          행 번호 사용
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button className="text-sm border rounded px-3 py-1" onClick={onCancel}>
            취소
          </button>
          <button
            className="text-sm bg-teal-600 text-white rounded px-3 py-1"
            onClick={() => onCreate({ label, maxRows, blankRowPolicy, useRowNumber })}
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  );
}

