"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FieldDTO, FieldType, RepeatGroupDTO, TemplateDetailResponse } from "@/types";
import { Button } from "@/components/ui";
import { LeftPanel } from "@/components/editor/LeftPanel";
import { PdfUploadEmpty } from "@/components/editor/PdfUploadEmpty";
import { PdfPageCanvas } from "@/components/editor/PdfPageCanvas";
import { FieldPropertiesPanel, GroupPropertiesPanel, type ChoiceOptionInput } from "@/components/editor/PropertiesPanel";
import { CreateRepeatGroupModal } from "@/components/editor/RepeatGroupModal";
import { MergeToChoiceModal } from "@/components/editor/MergeToChoiceModal";
import { DataTestDialog } from "@/components/editor/DataTestDialog";
import { ExcelTemplateModal } from "@/components/editor/ExcelTemplateModal";
import { clamp } from "@/components/editor/configPanels";
import { useCommandStack } from "@/lib/commandStack";
import { arrayBufferToBase64 } from "@/lib/base64";

const DEFAULT_BOX = { w: 0.16, h: 0.04 };
const CANVAS_TARGET_WIDTH = 760;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const PASTE_OFFSET_PX = 14;
type ResizeCorner = "nw" | "ne" | "se" | "sw";

type Tool = { mode: "select" } | { mode: "pan" } | { mode: "add"; type: FieldType };

type ClipboardField = Pick<FieldDTO, "label" | "type" | "required" | "config"> & {
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
};

const RESIZE_HANDLES: { corner: ResizeCorner; className: string }[] = [
  { corner: "nw", className: "-left-1 -top-1 cursor-nw-resize" },
  { corner: "ne", className: "-right-1 -top-1 cursor-ne-resize" },
  { corner: "sw", className: "-left-1 -bottom-1 cursor-sw-resize" },
  { corner: "se", className: "-right-1 -bottom-1 cursor-se-resize" },
];

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
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const pendingSaveCountRef = useRef(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [tool, setTool] = useState<Tool>({ mode: "select" });
  const [dragType, setDragType] = useState<FieldType | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [aiFilteredInfo, setAiFilteredInfo] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [optionDraw, setOptionDraw] = useState<{ fieldId: string; optionIndex: number } | null>(null);
  const [optionDrawPreview, setOptionDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<ClipboardField[]>([]);
  const suppressNextClickRef = useRef(false);
  const [hasClipboard, setHasClipboard] = useState(false);
  const stack = useCommandStack();

  const load = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}`);
    if (res.ok) setData(await res.json());
  }, [templateId]);

  const loadPdfBuffer = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}/pdf`);
    if (res.ok) setPdfBuffer(await res.arrayBuffer());
  }, [templateId]);

  // 헤더의 저장 상태 표시("자동 저장됨" 같은 고정 문구 대신 실제 저장 이벤트를 반영) +
  // 수동 "저장" 버튼 둘 다 이 카운터를 공유한다.
  function beginSave() {
    pendingSaveCountRef.current += 1;
    setSaveStatus("saving");
  }
  function endSave(ok: boolean) {
    pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
    if (!ok) {
      setSaveStatus("error");
      return;
    }
    if (pendingSaveCountRef.current === 0) {
      setSaveStatus("saved");
      setLastSavedAt(new Date());
    }
  }
  async function manualSave() {
    setSaveStatus("saving");
    await load();
    setSaveStatus("saved");
    setLastSavedAt(new Date());
  }

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
    beginSave();
    try {
      const res = await fetch(`/api/templates/${templateId}/fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) patchLocalField(id, await res.json());
      endSave(res.ok);
    } catch {
      endSave(false);
    }
  }

  function patchConfig<K extends "text" | "number" | "check" | "date" | "time" | "choice">(
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
    const label = {
      text: "새 텍스트",
      number: "새 숫자",
      date: "새 날짜",
      time: "새 시간",
      check: "새 체크",
      choice: "새 선택",
    }[type];
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

  // PRD_양식편집기_상세 §14.1: 여러 필드를 복사하면 상대적인 위치와 옵션 설정을 유지하고,
  // 붙여넣은 필드는 원본에서 14px 이동하며 고유 데이터 키를 자동 생성한다.
  function copySelected() {
    const targets = multiSelectIds.length > 0 ? allFields.filter((f) => multiSelectIds.includes(f.id)) : selected ? [selected] : [];
    if (targets.length === 0) return;
    clipboardRef.current = targets.map((f) => ({
      label: f.label,
      type: f.type,
      required: f.required,
      config: f.config,
      boxX: f.boxX,
      boxY: f.boxY,
      boxW: f.boxW,
      boxH: f.boxH,
    }));
    setHasClipboard(true);
  }

  async function pasteClipboard() {
    if (readOnly || clipboardRef.current.length === 0) return;
    const offsetX = pdfSize ? PASTE_OFFSET_PX / pdfSize.width : 0.02;
    const offsetY = pdfSize ? PASTE_OFFSET_PX / pdfSize.height : 0.02;
    const createdIds: string[] = [];
    for (const snapshot of clipboardRef.current) {
      const box = {
        x: clamp(snapshot.boxX + offsetX, 0, 1 - snapshot.boxW),
        y: clamp(snapshot.boxY + offsetY, 0, 1 - snapshot.boxH),
        w: snapshot.boxW,
        h: snapshot.boxH,
      };
      const res = await fetch(`/api/templates/${templateId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNo, label: snapshot.label, type: snapshot.type, box, required: snapshot.required, config: snapshot.config }),
      });
      if (res.ok) {
        const field: FieldDTO = await res.json();
        createdIds.push(field.id);
      }
    }
    if (createdIds.length === 0) return;
    stack.record({
      label: "필드 붙여넣기",
      do: () => {},
      undo: async () => {
        await Promise.all(createdIds.map((id) => fetch(`/api/templates/${templateId}/fields/${id}`, { method: "DELETE" })));
        setSelectedId(null);
        setMultiSelectIds([]);
        await load();
      },
    });
    await load();
    if (createdIds.length === 1) {
      setSelectedId(createdIds[0]);
      setMultiSelectIds([]);
    } else {
      setSelectedId(null);
      setMultiSelectIds(createdIds);
    }
  }

  async function saveChoiceOptions(fieldId: string, options: ChoiceOptionInput[]) {
    beginSave();
    try {
      const res = await fetch(`/api/templates/${templateId}/fields/${fieldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choiceOptions: options }),
      });
      if (res.ok) {
        const updated: FieldDTO = await res.json();
        patchLocalField(fieldId, { choiceOptions: updated.choiceOptions });
      }
      endSave(res.ok);
    } catch {
      endSave(false);
    }
  }

  function patchLocalGroup(id: string, patch: Partial<RepeatGroupDTO>) {
    setData((d) => (d ? { ...d, repeatGroups: d.repeatGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)) } : d));
  }

  async function saveGroup(id: string, body: Record<string, unknown>) {
    beginSave();
    try {
      const res = await fetch(`/api/templates/${templateId}/repeat-groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) patchLocalGroup(id, await res.json());
      endSave(res.ok);
    } catch {
      endSave(false);
    }
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

  // PRD_양식편집기_상세 §14.1: 이미 좌표가 잡혀 있는 개별 필드(주로 check)들을 다시 그리지
  // 않고 그대로 옵션 영역으로 재사용해 선택 필드 하나로 묶는다.
  async function mergeToChoice(opts: { label: string; mode: "single" | "multiple" }) {
    const sourceSnapshots = allFields.filter((f) => multiSelectIds.includes(f.id));
    const res = await fetch(`/api/templates/${templateId}/fields/merge-to-choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldIds: multiSelectIds, label: opts.label, mode: opts.mode }),
    });
    if (res.ok) {
      const field: FieldDTO = await res.json();
      stack.record({
        label: "선택 필드로 묶기",
        do: () => {},
        undo: async () => {
          await fetch(`/api/templates/${templateId}/fields/${field.id}`, { method: "DELETE" });
          await Promise.all(
            sourceSnapshots.map((s) =>
              fetch(`/api/templates/${templateId}/fields`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  pageNo: s.pageNo,
                  label: s.label,
                  dataKey: s.dataKey,
                  type: s.type,
                  box: { x: s.boxX, y: s.boxY, w: s.boxW, h: s.boxH },
                  required: s.required,
                  config: s.config,
                }),
              })
            )
          );
          setSelectedId(null);
          await load();
        },
      });
      setMultiSelectIds([]);
      setMergeModalOpen(false);
      await load();
      setSelectedId(field.id);
    } else {
      const json = await res.json();
      setActionError(
        json.error === "FIELDS_MUST_SHARE_PAGE" ? "같은 페이지의 필드만 묶을 수 있습니다." : "선택 필드로 묶기 실패"
      );
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
    if (optionDraw || tool.mode === "pan") return; // 옵션 영역 지정·이동 도구 중에는 캔버스 레벨 드래그로 넘긴다
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
        // stack.run은 do()를 즉시 실행하고 undo 스택에 등록한다 — stack.record는 "이미
        // 실행된" 명령을 등록만 할 뿐 do()를 호출하지 않으므로, 여기서 record를 쓰면
        // 드래그 이동이 서버에 저장되지 않고 다음 전체 재조회 때 원래 위치로 되돌아간다.
        stack.run({
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
    // 병합된 선택(choice) 필드는 삭제하면 良/否 같은 개별 판정 영역 정의가 통째로 사라진다.
    // 되돌릴 수 없는 선택이라 삭제 전에 "개별 필드로 복원할지"부터 물어본다.
    if (field.type === "choice" && field.choiceOptions.length > 0) {
      const restore = window.confirm(
        `"${field.label}"은(는) ${field.choiceOptions.length}개 옵션이 합쳐진 선택 필드입니다.\n\n확인: 개별 체크 필드 ${field.choiceOptions.length}개로 복원\n취소: 다음 화면에서 완전 삭제 여부 선택`
      );
      if (restore) {
        const r = await fetch(`/api/templates/${templateId}/fields/${field.id}/split-choice`, { method: "POST" });
        if (r.ok) {
          if (selectedId === field.id) setSelectedId(null);
          await load();
        } else if (r.status === 409) {
          setActionError("잠긴 필드는 복원할 수 없습니다.");
        } else {
          setActionError("옵션에 영역이 지정되지 않아 개별 필드로 복원할 수 없습니다.");
        }
        return;
      }
      const reallyDelete = window.confirm(`"${field.label}"과 옵션 ${field.choiceOptions.length}개를 모두 삭제합니다. 계속할까요?`);
      if (!reallyDelete) return;
    }
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

  // "선택 필드로 묶기"의 반대 동작: 병합된 choice 필드를 다시 개별 체크 필드들로 되돌린다.
  async function splitChoiceField(field: FieldDTO) {
    const r = await fetch(`/api/templates/${templateId}/fields/${field.id}/split-choice`, { method: "POST" });
    if (r.ok) {
      if (selectedId === field.id) setSelectedId(null);
      await load();
    } else if (r.status === 409) {
      setActionError("잠긴 필드는 복원할 수 없습니다.");
    } else {
      setActionError("옵션에 영역이 지정되지 않아 개별 필드로 복원할 수 없습니다.");
    }
  }

  async function deleteSelectedFields() {
    const targets = multiSelectIds.length > 0 ? allFields.filter((f) => multiSelectIds.includes(f.id)) : selected ? [selected] : [];
    for (const f of targets) await deleteField(f);
    setMultiSelectIds([]);
  }

  async function runAiDetection() {
    if (!pdfBuffer) return;
    setActionError(null);
    setAiFilteredInfo(null);
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
      if (json.filteredOutCount > 0) {
        setAiFilteredInfo(`신뢰도가 낮거나 영역이 너무 작은 후보 ${json.filteredOutCount}개는 자동으로 제외했습니다.`);
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

  // PRD_양식편집기_상세 §14.1: 양식명은 상단 제목을 클릭하여 직접 수정하고, 자동 저장 대상이다.
  async function saveTemplateName(name: string) {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === data?.template.name) return;
    beginSave();
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) await load();
      endSave(res.ok);
    } catch {
      endSave(false);
    }
  }

  // draft → printable은 구조 검사를 통과해야 하므로 /activate를 거친다.
  async function activateTemplate() {
    setActionError(null);
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/activate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        const reasons = (json.issues ?? []).map((i: { message: string }) => i.message).join(", ");
        setActionError(reasons || json.reason || "인쇄 가능 전환 실패");
      }
      await load();
    } finally {
      setStatusBusy(false);
    }
  }

  // printable → draft는 검사 없이 바로 되돌릴 수 있다(사용자 확정 사양).
  async function reopenForEditing() {
    setActionError(null);
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (res.ok) await load();
      setStatusBusy(false);
    } catch {
      setStatusBusy(false);
    }
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

  function zoomIn() {
    setZoom((z) => clamp(Math.round((z + ZOOM_STEP) * 100) / 100, ZOOM_MIN, ZOOM_MAX));
  }
  function zoomOut() {
    setZoom((z) => clamp(Math.round((z - ZOOM_STEP) * 100) / 100, ZOOM_MIN, ZOOM_MAX));
  }
  function fitToScreen() {
    const container = canvasScrollRef.current;
    if (!container || !pdfSize) {
      setZoom(1);
      return;
    }
    const intrinsicWidth = pdfSize.width / zoom;
    const intrinsicHeight = pdfSize.height / zoom;
    const availWidth = container.clientWidth - 64;
    const availHeight = container.clientHeight - 64;
    const next = Math.min(availWidth / intrinsicWidth, availHeight / intrinsicHeight);
    setZoom(clamp(Math.round(next * 100) / 100, ZOOM_MIN, ZOOM_MAX));
  }

  function computeCanvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (tool.mode === "pan") return;
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

  function startPan(e: React.PointerEvent) {
    if (tool.mode !== "pan" || !canvasScrollRef.current) return;
    e.preventDefault();
    const scrollEl = canvasScrollRef.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = scrollEl.scrollLeft;
    const startTop = scrollEl.scrollTop;
    function onMove(ev: PointerEvent) {
      scrollEl.scrollLeft = startLeft - (ev.clientX - startX);
      scrollEl.scrollTop = startTop - (ev.clientY - startY);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // 캔버스 빈 영역을 드래그하면 겹치는 필드를 모두 다중 선택한다 (필드/그룹 위에서는
  // 각자 onPointerDown이 stopPropagation하므로 여기까지 도달하지 않는다).
  function startMarqueeSelect(e: React.PointerEvent) {
    if (optionDraw || tool.mode !== "select" || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startPt = computeCanvasPoint(e.clientX, e.clientY);
    if (!startPt) return;
    const additive = e.shiftKey;
    let moved = false;

    function rectFrom(clientX: number, clientY: number) {
      const curX = clamp((clientX - rect.left) / rect.width, 0, 1);
      const curY = clamp((clientY - rect.top) / rect.height, 0, 1);
      return {
        x: Math.min(startPt!.x, curX),
        y: Math.min(startPt!.y, curY),
        w: Math.abs(curX - startPt!.x),
        h: Math.abs(curY - startPt!.y),
      };
    }
    function onMove(ev: PointerEvent) {
      const box = rectFrom(ev.clientX, ev.clientY);
      if (box.w > 0.004 || box.h > 0.004) moved = true;
      setMarquee(box);
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (!moved) return;
      suppressNextClickRef.current = true;
      const box = rectFrom(ev.clientX, ev.clientY);
      const hitIds = fields
        .filter((f) => f.boxX < box.x + box.w && f.boxX + f.boxW > box.x && f.boxY < box.y + box.h && f.boxY + f.boxH > box.y)
        .map((f) => f.id);
      setSelectedId(null);
      setSelectedGroupId(null);
      setMultiSelectIds((prev) => (additive ? Array.from(new Set([...prev, ...hitIds])) : hitIds));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startOptionRegionDraw(e: React.PointerEvent) {
    if (!optionDraw || readOnly || !canvasRef.current) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const startPt = computeCanvasPoint(e.clientX, e.clientY);
    if (!startPt) return;
    const draw = optionDraw;

    function rectFrom(clientX: number, clientY: number) {
      const curX = clamp((clientX - rect.left) / rect.width, 0, 1);
      const curY = clamp((clientY - rect.top) / rect.height, 0, 1);
      return {
        x: Math.min(startPt!.x, curX),
        y: Math.min(startPt!.y, curY),
        w: Math.max(0.01, Math.abs(curX - startPt!.x)),
        h: Math.max(0.01, Math.abs(curY - startPt!.y)),
      };
    }
    function onMove(ev: PointerEvent) {
      setOptionDrawPreview(rectFrom(ev.clientX, ev.clientY));
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setOptionDrawPreview(null);
      suppressNextClickRef.current = true;
      const box = rectFrom(ev.clientX, ev.clientY);
      const field = allFields.find((f) => f.id === draw.fieldId);
      if (field) {
        const next: ChoiceOptionInput[] = field.choiceOptions.map((o, i) => ({
          label: o.label,
          storedValue: o.storedValue,
          region:
            i === draw.optionIndex
              ? box
              : o.regionX !== null && o.regionY !== null && o.regionW !== null && o.regionH !== null
                ? { x: o.regionX, y: o.regionY, w: o.regionW, h: o.regionH }
                : null,
        }));
        saveChoiceOptions(draw.fieldId, next);
      }
      setOptionDraw(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // 마퀴 등으로 여러 필드가 선택된 상태에서 그 중 하나를 드래그하면 전체가 같은 만큼 이동한다.
  function startGroupMove(e: React.PointerEvent) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const targets = allFields.filter((f) => multiSelectIds.includes(f.id) && !f.locked);
    if (targets.length === 0) return;
    const starts = new Map(targets.map((f) => [f.id, { x: f.boxX, y: f.boxY, w: f.boxW, h: f.boxH }]));

    function onMove(ev: PointerEvent) {
      let dx = (ev.clientX - startX) / rect.width;
      let dy = (ev.clientY - startY) / rect.height;
      // 그룹 중 가장 타이트한 필드를 기준으로 dx/dy를 함께 제한해야 서로 어긋나지 않는다.
      for (const s of starts.values()) {
        dx = clamp(dx, -s.x, 1 - s.w - s.x);
        dy = clamp(dy, -s.y, 1 - s.h - s.y);
      }
      for (const [id, s] of starts) {
        patchLocalField(id, { boxX: s.x + dx, boxY: s.y + dy });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setData((d) => {
        if (!d) return d;
        const nextBoxes = new Map<string, { x: number; y: number; w: number; h: number }>();
        for (const [id, s] of starts) {
          const f = d.fields.find((x) => x.id === id);
          if (f && (f.boxX !== s.x || f.boxY !== s.y)) nextBoxes.set(id, { x: f.boxX, y: f.boxY, w: f.boxW, h: f.boxH });
        }
        if (nextBoxes.size > 0) {
          suppressNextClickRef.current = true;
          // stack.run이 do()를 실제로 실행한다 — record는 등록만 하고 실행하지 않는다.
          stack.run({
            label: "필드 여러 개 이동",
            do: async () => {
              await Promise.all([...nextBoxes].map(([id, box]) => saveField(id, { box })));
            },
            undo: async () => {
              await Promise.all([...nextBoxes.keys()].map((id) => saveField(id, { box: starts.get(id) })));
            },
          });
        }
        return d;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startDrag(field: FieldDTO, e: React.PointerEvent, mode: "move" | ResizeCorner) {
    if (optionDraw || tool.mode === "pan") return; // 옵션 영역 지정·이동 도구 중에는 캔버스 레벨 드래그로 넘긴다
    e.stopPropagation();
    if (readOnly || field.locked || !canvasRef.current) return;
    if (mode === "move" && multiSelectIds.length > 1 && multiSelectIds.includes(field.id)) {
      startGroupMove(e);
      return;
    }
    setSelectedId(field.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: field.boxX, y: field.boxY, w: field.boxW, h: field.boxH };
    const MIN_SIZE = 0.02;

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "move") {
        patchLocalField(field.id, {
          boxX: clamp(start.x + dx, 0, 1 - start.w),
          boxY: clamp(start.y + dy, 0, 1 - start.h),
        });
        return;
      }
      // 반대편 모서리를 고정 앵커로 두고 x/w, y/h를 함께 계산한다 — 각각 따로 clamp하면
      // 마우스가 반대편 경계를 넘어갈 때 위치와 크기가 서로 어긋난다.
      let x: number;
      let w: number;
      if (mode === "nw" || mode === "sw") {
        const anchorRight = start.x + start.w;
        x = clamp(start.x + dx, 0, anchorRight - MIN_SIZE);
        w = anchorRight - x;
      } else {
        x = start.x;
        w = clamp(start.w + dx, MIN_SIZE, 1 - x);
      }
      let y: number;
      let h: number;
      if (mode === "nw" || mode === "ne") {
        const anchorBottom = start.y + start.h;
        y = clamp(start.y + dy, 0, anchorBottom - MIN_SIZE);
        h = anchorBottom - y;
      } else {
        y = start.y;
        h = clamp(start.h + dy, MIN_SIZE, 1 - y);
      }
      patchLocalField(field.id, { boxX: x, boxY: y, boxW: w, boxH: h });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setData((d) => {
        const f = d?.fields.find((x) => x.id === field.id);
        if (f && (f.boxX !== start.x || f.boxY !== start.y || f.boxW !== start.w || f.boxH !== start.h)) {
          const next = { x: f.boxX, y: f.boxY, w: f.boxW, h: f.boxH };
          // stack.run이 do()를 실제로 실행한다 — record는 등록만 하고 실행하지 않는다.
          stack.run({
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
      if (e.key === "Escape" && optionDraw) {
        setOptionDraw(null);
        return;
      }
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
      if (meta && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelected();
        return;
      }
      if (meta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && (selected || multiSelectIds.length > 0)) {
        e.preventDefault();
        deleteSelectedFields();
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
  }, [selected, multiSelectIds, stack, optionDraw]);

  if (!data) return <div className="p-8 text-sm text-slate-400">불러오는 중…</div>;

  return (
    <main className="flex flex-col h-full">
      <header className="bg-white border-b border-[var(--color-border)]">
        {/* 1행: 뒤로 · 양식명(직접 수정) · 상태 · 데이터 테스트 · 편집 완료 (PRD_양식편집기_상세 §6) */}
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-[var(--color-border)]/60">
          <Link
            href="/templates"
            className="text-sm text-slate-400 hover:text-[var(--foreground)] px-1.5 py-1 rounded cursor-pointer"
            title="양식 관리로 돌아가기"
          >
            ← 뒤로
          </Link>
          {editingName ? (
            <input
              autoFocus
              className="font-semibold text-sm rounded-md border border-[var(--color-brand-500)] ring-2 ring-[var(--color-brand-100)] px-2 py-1 mr-2 w-96 outline-none"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => saveTemplateName(nameDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTemplateName(nameDraft);
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <button
              className="font-semibold text-sm mr-2 truncate max-w-96 px-2 py-1 rounded-md border border-dashed border-[var(--color-border)] hover:border-[var(--color-brand-400)] hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
              disabled={readOnly}
              onClick={() => {
                setNameDraft(data.template.name);
                setEditingName(true);
              }}
              title="클릭해서 양식명 수정"
            >
              {data.template.name}
              {!readOnly && <span className="text-xs text-slate-400">✎</span>}
            </button>
          )}
          <span className={`text-xs ${saveStatus === "error" ? "text-red-600" : "text-slate-400"}`}>
            {saveStatus === "saving"
              ? "저장 중…"
              : saveStatus === "error"
                ? "저장 실패 — 저장 버튼을 눌러 다시 확인하세요"
                : lastSavedAt
                  ? `${lastSavedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}에 저장됨`
                  : "자동 저장"}
          </span>
          <div className="flex-1" />
          <Button onClick={manualSave} disabled={saveStatus === "saving"} title="서버에 저장된 최신 상태를 다시 불러와 확인합니다">
            💾 저장
          </Button>
          <Button onClick={() => setTestDialogOpen(true)} title="빈 원본 양식에서 필드 출력 구조·CSV 열 구성 확인">
            ▷ 데이터 테스트
          </Button>
          <Button onClick={() => setExcelModalOpen(true)} title="고객 엑셀 서식에 [데이터키]를 넣어 업로드하면 확정값으로 치환해 출력합니다">
            📊 Data Template
          </Button>
          {/* 상태는 편집기 전체 잠금 여부를 결정하는 중요한 토글이라, 눈에 잘 띄게 세그먼트
              버튼 형태로 뒀다(대시보드 고객사/시스템 토글과 같은 스타일). 실패 사유는 여기
              고정 표시하지 않고, 시도한 순간에만 아래 배너로 보여준다. */}
          <div className="flex rounded-lg border border-[var(--color-border)] bg-white p-0.5 text-xs">
            <button
              onClick={() => data.template.status !== "draft" && reopenForEditing()}
              disabled={statusBusy}
              className={`rounded-md px-3 py-1.5 font-medium cursor-pointer transition-colors ${
                data.template.status === "draft" ? "bg-slate-600 text-white" : "text-slate-500 hover:text-[var(--foreground)]"
              }`}
            >
              편집 중
            </button>
            <button
              onClick={() => data.template.status !== "printable" && activateTemplate()}
              disabled={statusBusy}
              className={`rounded-md px-3 py-1.5 font-medium cursor-pointer transition-colors ${
                data.template.status === "printable"
                  ? "bg-[var(--color-status-green-fg)] text-white"
                  : "text-slate-500 hover:text-[var(--foreground)]"
              }`}
            >
              인쇄 가능
            </button>
          </div>
        </div>

        {/* 2행: 선택/이동 · 실행취소/다시실행 · 복사/붙여넣기/삭제 · 확대축소 · AI 추천 · 페이지 */}
        <div className="px-4 py-2 flex items-center gap-1.5 flex-wrap">
          <ToolGroup label="도구">
            <ToolButton active={tool.mode === "select"} onClick={() => setTool({ mode: "select" })} title="선택 (필드를 클릭·드래그해서 선택·이동)">
              ⛶ 선택
            </ToolButton>
            <ToolButton active={tool.mode === "pan"} onClick={() => setTool({ mode: "pan" })} title="이동 (캔버스를 드래그해서 화면 이동)">
              ✋ 이동
            </ToolButton>
          </ToolGroup>

          <ToolGroup label="실행 내역">
            <Button onClick={() => stack.undo()} disabled={!stack.canUndo} title="실행 취소 (Cmd/Ctrl+Z)">
              ↩ 실행 취소
            </Button>
            <Button onClick={() => stack.redo()} disabled={!stack.canRedo} title="다시 실행 (Cmd/Ctrl+Shift+Z)">
              ↪ 다시 실행
            </Button>
          </ToolGroup>

          {!readOnly && (
            <ToolGroup label="필드">
              <Button onClick={copySelected} disabled={!selected && multiSelectIds.length === 0} title="복사 (Cmd/Ctrl+C)">
                ⧉ 복사
              </Button>
              <Button onClick={pasteClipboard} disabled={!hasClipboard} title="붙여넣기 (Cmd/Ctrl+V)">
                📋 붙여넣기
              </Button>
              <Button onClick={deleteSelectedFields} disabled={!selected && multiSelectIds.length === 0} title="삭제 (Delete)">
                🗑 삭제
              </Button>
            </ToolGroup>
          )}

          <ToolGroup label="화면">
            <Button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="축소">
              −
            </Button>
            <span className="text-xs text-slate-400 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="확대">
              +
            </Button>
            <Button onClick={fitToScreen} title="화면 맞춤">
              화면 맞춤
            </Button>
          </ToolGroup>

          {!readOnly && multiSelectIds.length > 0 && (
            <button className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 font-medium cursor-pointer" onClick={() => setGroupModalOpen(true)}>
              반복행으로 묶기 ({multiSelectIds.length})
            </button>
          )}
          {!readOnly && multiSelectIds.length >= 2 && (
            <button
              className="text-sm bg-violet-600 text-white rounded-lg px-3 py-1.5 font-medium cursor-pointer"
              onClick={() => setMergeModalOpen(true)}
            >
              선택 필드로 묶기 ({multiSelectIds.length})
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
          {data.version.pageCount > 1 && (
            <div className="flex items-center gap-1">
              <Button onClick={() => setPageNo((p) => Math.max(1, p - 1))} disabled={pageNo <= 1} title="이전 페이지">
                ‹
              </Button>
              <span className="text-xs text-slate-400 tabular-nums">
                {pageNo} / {data.version.pageCount}페이지
              </span>
              <Button
                onClick={() => setPageNo((p) => Math.min(data.version.pageCount, p + 1))}
                disabled={pageNo >= data.version.pageCount}
                title="다음 페이지"
              >
                ›
              </Button>
            </div>
          )}
        </div>
      </header>

      {aiFilteredInfo && !actionError && (
        <div className="bg-violet-50 border-b border-violet-200 px-4 py-2 text-sm text-violet-700">{aiFilteredInfo}</div>
      )}

      {actionError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">{actionError}</div>
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
          <div
            ref={canvasScrollRef}
            onPointerDown={startPan}
            className="flex-1 overflow-auto bg-slate-100 p-8"
            style={{ cursor: tool.mode === "pan" ? "grab" : "default" }}
          >
            {uploadBusy && <p className="text-sm text-slate-400 mb-2">PDF 업로드 중…</p>}
            {!pdfBuffer ? (
              <p className="text-sm text-slate-400">PDF 불러오는 중…</p>
            ) : (
              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                onPointerDown={(e) => {
                  startOptionRegionDraw(e);
                  startMarqueeSelect(e);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleCanvasDrop}
                className="relative bg-white shadow mx-auto"
                style={{
                  width: pdfSize?.width ?? CANVAS_TARGET_WIDTH,
                  height: pdfSize?.height,
                  cursor: optionDraw ? "crosshair" : tool.mode === "add" ? "crosshair" : tool.mode === "pan" ? "grab" : "default",
                }}
              >
                <PdfPageCanvas
                  pdfBuffer={pdfBuffer}
                  pageNo={pageNo}
                  width={Math.round(CANVAS_TARGET_WIDTH * zoom)}
                  onSize={setPdfSize}
                />
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
                  {selected?.type === "choice" &&
                    selected.choiceOptions.map((o, i) =>
                      o.regionX === null || o.regionY === null || o.regionW === null || o.regionH === null ? null : (
                        <div
                          key={o.id}
                          className={`absolute border-2 border-dashed pointer-events-none ${
                            optionDraw?.optionIndex === i ? "border-amber-500 bg-amber-50/40" : "border-sky-500 bg-sky-50/30"
                          }`}
                          style={{ left: `${o.regionX * 100}%`, top: `${o.regionY * 100}%`, width: `${o.regionW * 100}%`, height: `${o.regionH * 100}%` }}
                        >
                          <span className="absolute -top-4 left-0 text-[9px] text-sky-700 bg-white/80 px-0.5 whitespace-nowrap">{o.label}</span>
                        </div>
                      )
                    )}
                  {optionDrawPreview && (
                    <div
                      className="absolute border-2 border-amber-500 bg-amber-50/40 pointer-events-none"
                      style={{
                        left: `${optionDrawPreview.x * 100}%`,
                        top: `${optionDrawPreview.y * 100}%`,
                        width: `${optionDrawPreview.w * 100}%`,
                        height: `${optionDrawPreview.h * 100}%`,
                      }}
                    />
                  )}
                  {marquee && (
                    <div
                      className="absolute border-2 border-[var(--color-brand-500)] bg-[var(--color-brand-100)]/30 pointer-events-none"
                      style={{
                        left: `${marquee.x * 100}%`,
                        top: `${marquee.y * 100}%`,
                        width: `${marquee.w * 100}%`,
                        height: `${marquee.h * 100}%`,
                      }}
                    />
                  )}
                  {fields.map((f) =>
                    f.hidden ? null : (
                      <div
                        key={f.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressNextClickRef.current) {
                            suppressNextClickRef.current = false;
                            return;
                          }
                          selectField(f.id, e.shiftKey);
                        }}
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
                        {f.id === selectedId &&
                          !f.locked &&
                          RESIZE_HANDLES.map((handle) => (
                            <div
                              key={handle.corner}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                startDrag(f, e, handle.corner);
                              }}
                              className={`absolute w-3 h-3 bg-[var(--color-brand-600)] ${handle.className}`}
                            />
                          ))}
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
              templateId={templateId}
              onPatchLocal={(patch) => patchLocalGroup(selectedGroup.id, patch)}
              onSave={(body) => saveGroup(selectedGroup.id, body)}
              onUngroup={ungroupSelected}
              onColumnsChanged={load}
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
              onSplitChoice={selected.type === "choice" && selected.choiceOptions.length > 0 ? () => splitChoiceField(selected) : undefined}
              onSaveChoiceOptions={(options) => saveChoiceOptions(selected.id, options)}
              onArmOptionRegion={(optionIndex) =>
                setOptionDraw(optionIndex === null ? null : { fieldId: selected.id, optionIndex })
              }
              armedOptionIndex={optionDraw?.fieldId === selected.id ? optionDraw.optionIndex : null}
            />
          )}
        </aside>
      </div>

      <footer className="bg-white border-t border-[var(--color-border)] px-4 py-1.5 flex items-center gap-4 text-xs text-slate-400">
        <span>페이지 {pageNo}/{data.version.pageCount}</span>
        <span>선택 {selectedId || selectedGroupId ? 1 : multiSelectIds.length}개</span>
        <span>정규화 좌표 (0~1)</span>
      </footer>

      {groupModalOpen && (
        <CreateRepeatGroupModal fieldCount={multiSelectIds.length} onCancel={() => setGroupModalOpen(false)} onCreate={createRepeatGroup} />
      )}

      {mergeModalOpen && (
        <MergeToChoiceModal fieldCount={multiSelectIds.length} onCancel={() => setMergeModalOpen(false)} onCreate={mergeToChoice} />
      )}

      {testDialogOpen && (
        <DataTestDialog
          templateName={data.template.name}
          fields={allFields}
          repeatGroups={data.repeatGroups}
          pdfBuffer={pdfBuffer}
          pageNo={pageNo}
          onClose={() => setTestDialogOpen(false)}
        />
      )}

      {excelModalOpen && <ExcelTemplateModal versionId={data.version.id} onClose={() => setExcelModalOpen(false)} />}
    </main>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`text-sm rounded-lg px-3 py-1.5 font-medium border cursor-pointer ${
        active ? "bg-[var(--color-brand-600)] text-white border-[var(--color-brand-600)]" : "border-[var(--color-border)] hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

// 툴바를 기능 단위로 시각적 그룹핑해서 가독성을 높인다 — 그룹 사이에만 구분선을 둔다.
function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 pr-2.5 mr-1 border-r border-[var(--color-border)] last:border-r-0" title={label}>
      {children}
    </div>
  );
}
