"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import type { FieldDTO, FieldIssue, FieldType, TemplateDetailResponse } from "@/types";

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
  const [tool, setTool] = useState<Tool>({ mode: "select" });
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
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
  const selected = fields.find((f) => f.id === selectedId) ?? null;

  function patchLocalField(id: string, patch: Partial<FieldDTO>) {
    setData((d) => (d ? { ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : d));
  }

  async function saveField(id: string, patch: Partial<FieldDTO>) {
    const body: Record<string, unknown> = {};
    if (patch.label !== undefined) body.label = patch.label;
    if (patch.required !== undefined) body.required = patch.required;
    if (patch.type !== undefined) body.type = patch.type;
    if (
      patch.boxX !== undefined ||
      patch.boxY !== undefined ||
      patch.boxW !== undefined ||
      patch.boxH !== undefined
    ) {
      const f = fields.find((x) => x.id === id);
      if (f) {
        body.box = {
          x: patch.boxX ?? f.boxX,
          y: patch.boxY ?? f.boxY,
          w: patch.boxW ?? f.boxW,
          h: patch.boxH ?? f.boxH,
        };
      }
    }
    await fetch(`/api/templates/${templateId}/fields/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
    if (tool.mode !== "add" || !canvasRef.current) return;
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
      if (f) saveField(field.id, f);
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
          <div className="flex-1" />
          <button className="text-sm border rounded px-3 py-1" onClick={runValidate}>
            검사
          </button>
          <button
            className="text-sm bg-blue-600 text-white rounded px-3 py-1"
            onClick={activate}
          >
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
            {fields.map((f) => (
              <div
                key={f.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(f.id);
                }}
                onPointerDown={(e) => startDrag(f, e, "move")}
                className={`absolute border-2 text-[10px] px-1 overflow-hidden select-none ${
                  f.id === selectedId
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

      <aside className="w-72 border-l p-4 overflow-y-auto">
        <h2 className="font-medium mb-3">필드 속성</h2>
        {!selected && <p className="text-sm text-gray-500">필드를 선택하세요.</p>}
        {selected && (
          <div className="space-y-3 text-sm">
            <Field label="라벨">
              <input
                className="border rounded px-2 py-1 w-full"
                value={selected.label}
                onChange={(e) => patchLocalField(selected.id, { label: e.target.value })}
                onBlur={() => saveField(selected.id, { label: selected.label })}
              />
            </Field>
            <Field label="데이터 키">
              <input className="border rounded px-2 py-1 w-full bg-gray-50 text-gray-500" value={selected.dataKey} readOnly />
            </Field>
            <Field label="유형">
              <select
                className="border rounded px-2 py-1 w-full"
                value={selected.type}
                onChange={(e) => {
                  const type = e.target.value as FieldType;
                  patchLocalField(selected.id, { type });
                  saveField(selected.id, { type });
                }}
              >
                <option value="text">텍스트</option>
                <option value="number">숫자</option>
                <option value="check">체크</option>
              </select>
            </Field>
            <label className="flex items-center gap-2">
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
            <div className="text-xs text-gray-400">
              {(selected.boxX * 100).toFixed(1)}%, {(selected.boxY * 100).toFixed(1)}% ·{" "}
              {(selected.boxW * 100).toFixed(1)}% × {(selected.boxH * 100).toFixed(1)}%
            </div>
            <button className="text-sm text-red-600 border border-red-200 rounded px-3 py-1 w-full" onClick={deleteSelected}>
              필드 삭제
            </button>
          </div>
        )}
      </aside>
    </main>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm rounded px-3 py-1 border ${active ? "bg-slate-800 text-white border-slate-800" : "border-gray-300"}`}
    >
      {children}
    </button>
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
