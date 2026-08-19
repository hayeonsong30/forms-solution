"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import type { FieldDTO, FieldIssue, FieldType, RepeatGroupDTO, TemplateDetailResponse } from "@/types";
import { Badge, Button } from "@/components/ui";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { PdfUploadEmpty } from "@/components/editor/PdfUploadEmpty";
import { PdfPageCanvas } from "@/components/editor/PdfPageCanvas";
import { FieldPropertiesPanel, GroupPropertiesPanel } from "@/components/editor/PropertiesPanel";
import { CreateRepeatGroupModal } from "@/components/editor/RepeatGroupModal";
import { clamp } from "@/components/editor/configPanels";
import { useCommandStack } from "@/lib/commandStack";
import { arrayBufferToBase64 } from "@/lib/base64";

const DEFAULT_BOX = { w: 0.16, h: 0.04 };
const CANVAS_TARGET_WIDTH = 760;

type Tool = { mode: "select" } | { mode: "add"; type: FieldType };

export default function EditorPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = use(params);

  const [data, setData] = useState<TemplateDetailResponse | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfSize, setPdfSize] = useState<{ width: number; height: number } | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [multiSelectIds, setMultiSelectIds] = useState<string[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [tool, setTool] = useState<Tool>({ mode: "select" });
  const [dragType, setDragType] = useState<FieldType | null>(null);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stack = useCommandStack();

  const load = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}`);
    if (res.ok) setData(await res.json());
  }, [templateId]);

  const loadPdfBuffer = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}/pdf`);
    if (res.ok) setPdfBuffer(await res.arrayBuffer());
  }, [templateId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  useEffect(() => {
    if (data?.version.hasPdf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the PDF once we know it exists
      loadPdfBuffer();
    }
  }, [data?.version.hasPdf, loadPdfBuffer]);

  const hasPdf = data?.version.hasPdf ?? false;
  // PRD_폼솔루션 §7.1.1: 편집 완료(draft가 아님) 후에는 PDF·필드·좌표를 수정할 수 없다.
  const readOnly = data ? data.template.status !== "draft" : false;
  const allFields = data?.fields ?? [];
  const fields = allFields.filter((f) => f.pageNo === pageNo);
  const repeatGroups = (data?.repeatGroups ?? []).filter((g) => g.pageNo === pageNo);
  const selected = allFields.find((f) => f.id === selectedId) ?? null;
  const selectedGroup = (data?.repeatGroups ?? []).find((g) => g.id === selectedGroupId) ?? null;
  const otherCheckFields = allFields.filter((f) => f.type === "check" && f.id !== selectedId);

  function patchLocalField(id: string, patch: Partial<FieldDTO>) {
    setData((d) => (d ? { ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : d));
  }

  async function saveField(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/templates/${templateId}/fields/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) patchLocalField(id, await res.json());
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

  // PRD_양식편집기_상세 §18 Phase 0: 상태 변경은 undo 가능한 명령으로 구현한다.
  function runFieldPatchCommand(field: FieldDTO, body: Record<string, unknown>, prevBody: Record<string, unknown>) {
    stack.run({
      label: "필드 속성 변경",
      do: () => saveField(field.id, body),
      undo: () => saveField(field.id, prevBody),
    });
  }

  async function createField(x: number, y: number, type: FieldType) {
    const box = {
      x: clamp(x - DEFAULT_BOX.w / 2, 0, 1 - DEFAULT_BOX.w),
      y: clamp(y - DEFAULT_BOX.h / 2, 0, 1 - DEFAULT_BOX.h),
      w: DEFAULT_BOX.w,
      h: DEFAULT_BOX.h,
    };
    const label = type === "text" ? "새 텍스트" : type === "number" ? "새 숫자" : "새 체크";
    let createdId: string | null = null;
    await stack.run({
      label: "필드 생성",
      do: async () => {
        const res = await fetch(`/api/templates/${templateId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageNo, label, type, box, required: false }),
        });
        if (res.ok) {
          const field: FieldDTO = await res.json();
          createdId = field.id;
          await load();
          setSelectedId(field.id);
          setTool({ mode: "select" });
        }
      },
      undo: async () => {
        if (!createdId) return;
        await fetch(`/api/templates/${templateId}/fields/${createdId}`, { method: "DELETE" });
        setSelectedId(null);
        await load();
      },
    });
  }

  async function duplicateSelected() {
    if (!selected) return;
    const offset = 0.012;
    const box = {
      x: clamp(selected.boxX + offset, 0, 1 - selected.boxW),
      y: clamp(selected.boxY + offset, 0, 1 - selected.boxH),
      w: selected.boxW,
      h: selected.boxH,
    };
    const res = await fetch(`/api/templates/${templateId}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageNo: selected.pageNo,
        label: `${selected.label} 복사`,
        type: selected.type,
        box,
        required: selected.required,
        config: selected.config,
      }),
    });
    if (res.ok) {
      const field: FieldDTO = await res.json();
      stack.record({
        label: "필드 복사",
        do: () => {},
        undo: async () => {
          await fetch(`/api/templates/${templateId}/fields/${field.id}`, { method: "DELETE" });
          setSelectedId(null);
          await load();
        },
      });
      await load();
      setSelectedId(field.id);
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

  function selectField(id: string, shiftKey = false) {
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
      stack.record({
        label: "반복행 생성",
        do: () => {},
        undo: async () => {
          await fetch(`/api/templates/${templateId}/repeat-groups/${group.id}`, { method: "DELETE" });
          setSelectedGroupId(null);
          await load();
        },
      });
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
    if (readOnly || !canvasRef.current) return;
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
      if (g && (g.areaX !== start.x || g.areaY !== start.y)) {
        stack.record({
          label: "반복행 이동",
          do: () => saveGroup(group.id, { area: { x: g.areaX, y: g.areaY, w: g.areaW } }),
          undo: () => saveGroup(group.id, { area: { x: start.x, y: start.y, w: g.areaW } }),
        });
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function deleteField(field: FieldDTO) {
    const snapshot = { ...field };
    const res = await fetch(`/api/templates/${templateId}/fields/${field.id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedId === field.id) setSelectedId(null);
      stack.record({
        label: "필드 삭제",
        do: () => {},
        undo: async () => {
          const r = await fetch(`/api/templates/${templateId}/fields`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageNo: snapshot.pageNo,
              label: snapshot.label,
              dataKey: snapshot.dataKey,
              type: snapshot.type,
              box: { x: snapshot.boxX, y: snapshot.boxY, w: snapshot.boxW, h: snapshot.boxH },
              required: snapshot.required,
              config: snapshot.config,
            }),
          });
          if (r.ok) await load();
        },
      });
      await load();
    } else if (res.status === 409) {
      setActionError("잠긴 필드는 삭제할 수 없습니다.");
    }
  }

  async function runAiDetection() {
    if (!pdfBuffer) return;
    setActionError(null);
    setAiBusy(true);
    try {
      const canvas = document.createElement("canvas");
      const { loadPdf, renderPageToCanvas } = await import("@/lib/pdf");
      const pdf = await loadPdf(pdfBuffer.slice(0));
      await renderPageToCanvas(pdf, pageNo, canvas, 1600, () => false);
      const dataUri = canvas.toDataURL("image/png");

      const res = await fetch(`/api/templates/${templateId}/ai-detection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUri: dataUri, pageNo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.message ?? "AI 자동 추천 실패");
        return;
      }
      await load();
    } finally {
      setAiBusy(false);
    }
  }

  async function acceptSuggested(field: FieldDTO) {
    await saveField(field.id, { status: "confirmed" });
  }

  async function rejectSuggested(field: FieldDTO) {
    await deleteField(field);
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

  async function uploadPdf(file: File) {
    setUploadBusy(true);
    setActionError(null);
    try {
      const buffer = await file.arrayBuffer();
      const { loadPdf } = await import("@/lib/pdf");
      const pdf = await loadPdf(buffer.slice(0));
      const pdfDataUri = `data:application/pdf;base64,${arrayBufferToBase64(buffer)}`;
      const res = await fetch(`/api/templates/${templateId}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfDataUri, pageCount: pdf.numPages }),
      });
      if (!res.ok) {
        setActionError("PDF 업로드에 실패했습니다.");
        return;
      }
      setPageNo(1);
      await load();
      await loadPdfBuffer();
    } finally {
      setUploadBusy(false);
    }
  }

  function computeCanvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (tool.mode !== "add") {
      setSelectedId(null);
      setSelectedGroupId(null);
      if (!e.shiftKey) setMultiSelectIds([]);
      return;
    }
    if (readOnly) return;
    const pt = computeCanvasPoint(e.clientX, e.clientY);
    if (pt) createField(pt.x, pt.y, tool.type);
  }

  function handleCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragType || readOnly) return;
    const pt = computeCanvasPoint(e.clientX, e.clientY);
    if (pt) createField(pt.x, pt.y, dragType);
    setDragType(null);
  }

  function startDrag(field: FieldDTO, e: React.PointerEvent, mode: "move" | "resize") {
    e.stopPropagation();
    if (readOnly || field.locked || !canvasRef.current) return;
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
      setData((d) => {
        const f = d?.fields.find((x) => x.id === field.id);
        if (f && (f.boxX !== start.x || f.boxY !== start.y || f.boxW !== start.w || f.boxH !== start.h)) {
          const next = { x: f.boxX, y: f.boxY, w: f.boxW, h: f.boxH };
          stack.record({
            label: mode === "move" ? "필드 이동" : "필드 크기 조절",
            do: () => saveField(field.id, { box: next }),
            undo: () => saveField(field.id, { box: start }),
          });
        }
        return d;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // 방향키 이동 (Shift = 큰 단위), Delete 삭제, Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Cmd/Ctrl+D 복제
  useEffect(() => {
    function isFormTarget(el: EventTarget | null) {
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isFormTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) stack.redo();
        else stack.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        deleteField(selected);
        return;
      }
      if (selected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.002;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const next = { x: clamp(selected.boxX + dx, 0, 1 - selected.boxW), y: clamp(selected.boxY + dy, 0, 1 - selected.boxH), w: selected.boxW, h: selected.boxH };
        patchLocalField(selected.id, { boxX: next.x, boxY: next.y });
        saveField(selected.id, { box: next });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-bind whenever selection/stack identity changes
  }, [selected, stack]);

  if (!data) return <div className="p-8 text-sm text-slate-400">불러오는 중…</div>;

  return (
    <main className="flex flex-col h-full">
      <header className="bg-white border-b border-[var(--color-border)] px-4 py-2.5 flex items-center gap-2">
        <h1 className="font-semibold text-sm mr-2 truncate max-w-48">{data.template.name}</h1>
        <span className="text-xs text-slate-400 mr-2">{pageNo} / {data.version.pageCount}페이지</span>
        <ToolButton active={tool.mode === "select"} onClick={() => setTool({ mode: "select" })}>
          선택
        </ToolButton>
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
        <Button onClick={() => stack.undo()} disabled={!stack.canUndo} title="실행 취소 (Cmd/Ctrl+Z)">
          ↶
        </Button>
        <Button onClick={() => stack.redo()} disabled={!stack.canRedo} title="다시 실행 (Cmd/Ctrl+Shift+Z)">
          ↷
        </Button>
        {!readOnly && multiSelectIds.length > 0 && (
          <button className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 font-medium cursor-pointer" onClick={() => setGroupModalOpen(true)}>
            반복행으로 묶기 ({multiSelectIds.length})
          </button>
        )}
        {!readOnly && (
          <button
            className="text-sm border border-violet-300 text-violet-700 rounded-lg px-3 py-1.5 font-medium cursor-pointer disabled:opacity-40"
            onClick={runAiDetection}
            disabled={!hasPdf || aiBusy}
          >
            {aiBusy ? "AI 분석 중… (최대 2분)" : "✦ AI 자동 추천"}
          </button>
        )}
        <div className="flex-1" />
        {!readOnly && (
          <>
            <Button onClick={runValidate}>검사</Button>
            <Button variant="primary" onClick={activate}>
              인쇄 가능으로 전환
            </Button>
          </>
        )}
        <Badge tone={data.template.printable ? "green" : "amber"}>
          {data.template.printable ? "인쇄 가능" : (data.template.printableReason ?? "편집 중")}
          {readOnly ? " · 조회 전용" : ""}
        </Badge>
      </header>

      {(issues.length > 0 || actionError) && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          {actionError && <div>{actionError}</div>}
          {issues.map((i, idx) => (
            <div key={idx}>{i.message}</div>
          ))}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <LeftPanel
          disabled={!hasPdf || readOnly}
          fields={fields}
          repeatGroups={repeatGroups}
          selectedId={selectedId}
          selectedGroupId={selectedGroupId}
          onSelectField={(id) => selectField(id)}
          onSelectGroup={selectGroup}
          onToggleHidden={(f) => (readOnly ? undefined : runFieldPatchCommand(f, { hidden: !f.hidden }, { hidden: f.hidden }))}
          onToggleLocked={(f) => (readOnly ? undefined : runFieldPatchCommand(f, { locked: !f.locked }, { locked: f.locked }))}
          onDeleteField={(f) => (readOnly ? undefined : deleteField(f))}
          onArmAdd={(type) => !readOnly && setTool(type ? { mode: "add", type } : { mode: "select" })}
          armedType={tool.mode === "add" ? tool.type : null}
          onDragCardStart={setDragType}
          onGroupCardClick={() =>
            !readOnly &&
            (multiSelectIds.length > 0 ? setGroupModalOpen(true) : setActionError("먼저 첫 행 필드를 다중 선택하세요 (Shift+클릭)."))
          }
          onReplacePdf={(file) => !readOnly && uploadPdf(file)}
        />

        {!hasPdf ? (
          <PdfUploadEmpty onUpload={uploadPdf} />
        ) : (
          <div className="flex-1 overflow-auto bg-slate-100 p-8">
            {uploadBusy && <p className="text-sm text-slate-400 mb-2">PDF 업로드 중…</p>}
            {!pdfBuffer ? (
              <p className="text-sm text-slate-400">PDF 불러오는 중…</p>
            ) : (
              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleCanvasDrop}
                className="relative bg-white shadow mx-auto"
                style={{
                  width: pdfSize?.width ?? CANVAS_TARGET_WIDTH,
                  height: pdfSize?.height,
                  cursor: tool.mode === "add" ? "crosshair" : "default",
                }}
              >
                <PdfPageCanvas pdfBuffer={pdfBuffer} pageNo={pageNo} width={CANVAS_TARGET_WIDTH} onSize={setPdfSize} />
                <div className="absolute inset-0">
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
                  {fields.map((f) =>
                    f.hidden ? null : (
                      <div
                        key={f.id}
                        onClick={(e) => selectField(f.id, e.shiftKey)}
                        onPointerDown={(e) => startDrag(f, e, "move")}
                        className={`absolute border-2 text-[10px] px-1 overflow-hidden select-none ${
                          multiSelectIds.includes(f.id)
                            ? "border-amber-500 bg-amber-50/70"
                            : f.id === selectedId
                              ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)]/70"
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
                        {f.locked && <span className="mr-0.5">🔒</span>}
                        {f.label}
                        {f.id === selectedId && !f.locked && (
                          <div
                            onPointerDown={(e) => startDrag(f, e, "resize")}
                            className="absolute -right-1 -bottom-1 w-3 h-3 bg-[var(--color-brand-600)] cursor-se-resize"
                          />
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <aside className={`w-80 bg-white border-l border-[var(--color-border)] overflow-y-auto ${readOnly ? "pointer-events-none opacity-60" : ""}`}>
          {!selected && !selectedGroup && <p className="p-4 text-sm text-slate-400">필드를 선택하세요.</p>}
          {selectedGroup && (
            <GroupPropertiesPanel
              group={selectedGroup}
              onPatchLocal={(patch) => patchLocalGroup(selectedGroup.id, patch)}
              onSave={(body) => saveGroup(selectedGroup.id, body)}
              onUngroup={ungroupSelected}
            />
          )}
          {selected && (
            <FieldPropertiesPanel
              field={selected}
              otherCheckFields={otherCheckFields}
              onPatchLocal={(patch) => patchLocalField(selected.id, patch)}
              onSave={(body) => saveField(selected.id, body)}
              onSaveType={(type) => saveField(selected.id, { type }).then(load)}
              onPatchConfig={(key, patch) => patchConfig(selected, key, patch)}
              onAccept={() => acceptSuggested(selected)}
              onReject={() => rejectSuggested(selected)}
              onDelete={() => deleteField(selected)}
            />
          )}
        </aside>
      </div>

      <footer className="bg-white border-t border-[var(--color-border)] px-4 py-1.5 flex items-center gap-4 text-xs text-slate-400">
        <span>페이지 {pageNo}/{data.version.pageCount}</span>
        <span>선택 {selectedId || selectedGroupId ? 1 : multiSelectIds.length}개</span>
        <span>오류 {issues.length}개</span>
        <span>정규화 좌표 (0~1)</span>
      </footer>

      {groupModalOpen && (
        <CreateRepeatGroupModal fieldCount={multiSelectIds.length} onCancel={() => setGroupModalOpen(false)} onCreate={createRepeatGroup} />
      )}
    </main>
  );
}

function ToolButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm rounded-lg px-3 py-1.5 font-medium border cursor-pointer ${
        active ? "bg-[var(--color-brand-600)] text-white border-[var(--color-brand-600)]" : "border-[var(--color-border)] hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
