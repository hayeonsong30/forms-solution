"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentDetailDTO, DocumentStatus, FieldType } from "@/types";
import { downloadExport } from "@/lib/downloadExport";
import { Badge, Button, ButtonLabel, Card, Input, Select } from "@/components/ui";
import { PdfPageCanvas } from "@/components/editor/PdfPageCanvas";

const STATUS: Record<DocumentStatus, { label: string; tone: "amber" | "green" | "slate" | "red" | "brand" }> = {
  printed: { label: "인쇄됨", tone: "slate" },
  received: { label: "작성", tone: "slate" },
  processing: { label: "처리 중", tone: "brand" },
  review_required: { label: "검수 필요", tone: "amber" },
  confirmed: { label: "확정", tone: "green" },
  error: { label: "오류", tone: "red" },
};

const REASON_LABEL: Record<string, string> = {
  required_missing: "필수값 누락",
  type_mismatch: "형식 오류",
  number_out_of_range: "숫자 범위 초과",
  invalid_date: "날짜 형식 오류",
  invalid_time: "시간 형식 오류",
  unknown_choice: "정의되지 않은 선택지",
  choice_conflict: "교차 검증 충돌",
  manual_review_requested: "AI 인식 없음 — 직접 확인 필요",
};

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "텍스트",
  number: "숫자",
  date: "날짜",
  time: "시간",
  check: "체크 판정",
  choice: "선택",
};

const ISSUE_REASONS = new Set(["required_missing", "type_mismatch", "invalid_date", "invalid_time", "number_out_of_range"]);

// 데모/시연용 — 켜져 있으면 문서 상태(확정 포함)와 무관하게 AI OCR을 다시 실행할 수 있다.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type RowStatus = "pending" | "issue" | "review" | "done";

function rowStatusOf(v: { reviewStatus: string; reviewReasons: string[]; rawOcrValue: string | null; normalizedValue: string | null; finalValue: string | null }): RowStatus {
  if (v.reviewStatus === "confirmed") return "done";
  if (v.rawOcrValue === null && v.normalizedValue === null && v.finalValue === null) return "pending";
  if (v.reviewReasons.some((r) => ISSUE_REASONS.has(r))) return "issue";
  return "review";
}

const ROW_STATUS_META: Record<RowStatus, { label: string; className: string }> = {
  pending: { label: "OCR 전", className: "bg-slate-100 text-slate-500" },
  issue: { label: "미입력·오류", className: "bg-red-50 text-red-600" },
  review: { label: "확인 필요", className: "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-fg)]" },
  done: { label: "완료", className: "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-fg)]" },
};

// 프로토타입 outputDialog(현행 확정 화면)과 동일한 구조로 맞춘다: 좌측 작성 원본 뷰어 +
// 우측 "인식된 필드값"(요약 4분류 + 필터 + 행 목록) + "CSV 자동 생성" 미리보기, 하단에
// 뒤로가기 + 안내 문구. 필드 행은 처리 전(OCR 전)에도 항상 목록으로 보여서 화면이 비어
// 보이지 않게 한다 — 값이 없으면 그 필드의 자리에 빈 입력 + "OCR 전" 태그만 뜬다.
export default function DocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const router = useRouter();
  const { documentId } = use(params);
  const [doc, setDoc] = useState<DocumentDetailDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopen, setShowReopen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // zoom=100은 "패널 너비에 꽉 채움"을 뜻한다 — 고정 700px 캔버스가 아니라 실측 패널 폭에
  // 비례한 값이라서, 화면이 커지면 원본도 같이 커진다("전체 화면으로" 피드백, 2026-08-20).
  const [zoom, setZoom] = useState(100);
  const sourceViewportRef = useRef<HTMLDivElement>(null);
  const [sourcePanelWidth, setSourcePanelWidth] = useState(700);
  const csvScrollRef = useRef<HTMLDivElement>(null);
  const [csvScrollMetrics, setCsvScrollMetrics] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });

  useEffect(() => {
    const el = csvScrollRef.current;
    if (!el) return;
    const update = () => setCsvScrollMetrics({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    update();
    el.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
    // doc이 로드되기 전엔 이 ref가 아직 렌더되지 않아 항상 null이다 — doc이 실제로
    // 생기는 시점에 맞춰 재실행해야 el을 제대로 잡는다 (위 sourceViewportRef와 동일한 이유).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  useEffect(() => {
    const el = sourceViewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setSourcePanelWidth(Math.max(320, Math.round(w - 44)));
    });
    observer.observe(el);
    return () => observer.disconnect();
    // doc이 null→로드됨으로 바뀌기 전까지는 이 ref를 단 element가 아직 트리에 없어서
    // effect가 처음(마운트) 실행될 때 잡는 el이 항상 null이었다 — []면 그걸로 끝이라
    // 다시는 재구독하지 않았다. doc이 실제로 생기는 시점에 맞춰 재실행되게 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);
  const [reviewFilter, setReviewFilter] = useState<"all" | "review" | "issue">("all");
  const [showJson, setShowJson] = useState(false);
  const [templatePdfBuffer, setTemplatePdfBuffer] = useState<ArrayBuffer | null>(null);
  const [, setTemplatePdfSize] = useState<{ width: number; height: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}`);
    if (res.ok) setDoc(await res.json());
  }, [documentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  // 아직 필기 이미지가 없으면(예: printed 상태) 대신 양식의 빈 PDF 1페이지를 원본 자리에
  // 보여준다 — 빈 화면 대신 "어떤 양식인지"라도 바로 확인할 수 있게.
  useEffect(() => {
    if (!doc || doc.pageImageCount > 0) return;
    let cancelled = false;
    fetch(`/api/templates/${doc.templateVersion.template.id}/pdf`)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => {
        if (!cancelled) setTemplatePdfBuffer(buf);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doc.templateVersion.template.id만 변하면 다시 받아온다
  }, [doc?.templateVersion.template.id, doc?.pageImageCount]);

  async function runAction(path: string, body?: Record<string, unknown>) {
    setActionError(null);
    setBusy(path);
    try {
      const res = await fetch(`/api/documents/${documentId}/${path}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(describeError(json));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  function readFileAsDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // "필기 이미지 업로드" — 이미지만 첨부하고(상태: 필기 수신) OCR은 별도로 실행한다.
  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUri = await readFileAsDataUri(file);
    await runAction("import", { pageImages: [dataUri] });
  }

  // "+ AI OCR 실행" — 버튼 라벨대로 이미지 업로드 직후 곧바로 OCR까지 이어서 실행한다.
  // (이전에는 업로드만 하고 끝나서, 화면이 다시 그려질 때까지 실제로는 아무 일도 일어나지
  // 않는 것처럼 보이는 버그가 있었다.)
  async function importAndRunOcr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setActionError(null);
    setBusy("import");
    try {
      const dataUri = await readFileAsDataUri(file);
      const importRes = await fetch(`/api/documents/${documentId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageImages: [dataUri] }),
      });
      const importJson = await importRes.json();
      if (!importRes.ok) {
        setActionError(describeError(importJson));
        return;
      }
      setBusy("process");
      const processRes = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      const processJson = await processRes.json();
      if (!processRes.ok) {
        setActionError(describeError(processJson));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function saveFinalValue(fieldValueId: string, finalValue: string | null) {
    await fetch(`/api/documents/${documentId}/field-values/${fieldValueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalValue }),
    });
    await load();
  }

  function focusKey(key: string) {
    setActiveKey(key);
    document.getElementById(`field-row-${key}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  if (!doc) return <div className="p-8 text-sm text-slate-400">불러오는 중…</div>;

  const status = STATUS[doc.status];
  const hasSourceImage = doc.pageImageCount > 0;
  const processed = doc.fieldValues.length > 0;

  const steps: { label: string; state: "done" | "active" | "pending" }[] = [
    { label: "필기 수신", state: doc.status === "printed" ? "active" : "done" },
    {
      label: "OCR 결과 확인",
      state: doc.status === "confirmed" ? "done" : processed || doc.status === "received" || doc.status === "processing" || doc.status === "error" ? "active" : "pending",
    },
    { label: "최종 확정", state: doc.status === "confirmed" ? "done" : "pending" },
  ];

  // 처리 전(fieldValues 없음)에는 템플릿 필드 구조로, 처리 후에는 실제 fieldValues로 행을 만든다.
  const rows: { key: string; label: string; required: boolean; dataKey: string; type: FieldType; value: DocumentDetailDTO["fieldValues"][number] | null }[] = processed
    ? doc.fieldValues.map((v) => {
        const source = v.field ?? v.repeatColumn;
        return {
          key: v.id,
          label: source ? `${source.label}${v.rowIndex !== null ? ` [행 ${v.rowIndex + 1}]` : ""}` : "-",
          required: source?.required ?? false,
          dataKey: source?.dataKey ?? "-",
          type: source?.type ?? "text",
          value: v,
        };
      })
    : doc.templateVersion.fields.map((f) => ({
        key: f.id,
        label: f.label,
        required: f.required,
        dataKey: f.dataKey,
        type: f.type,
        value: null,
      }));

  const rowStatuses = new Map(rows.map((r) => [r.key, r.value ? rowStatusOf(r.value) : "pending"]));
  const reviewCounts = {
    all: rows.length,
    done: rows.filter((r) => rowStatuses.get(r.key) === "done").length,
    review: rows.filter((r) => rowStatuses.get(r.key) === "review").length,
    issue: rows.filter((r) => rowStatuses.get(r.key) === "issue").length,
  };
  const filteredRows = rows.filter((r) => {
    if (reviewFilter === "review") return rowStatuses.get(r.key) === "review";
    if (reviewFilter === "issue") return rowStatuses.get(r.key) === "issue";
    return true;
  });

  // 실제 CSV/Excel 다운로드는 항상 finalValue(확정값)만 쓴다(confirmedJson.ts) — 그건
  // 안전장치라 그대로 둔다. 다만 이 미리보기는 확정 전이면 항상 텅 비어 보여서 "CSV
  // 자동생성이 안 된다"는 오해를 사기 쉬우니, 확정 전에는 AI 인식값을 "미확정" 표시와
  // 함께 미리 보여준다.
  const csvEntries = rows.map((r) => ({
    key: r.dataKey,
    sample: r.value?.finalValue ?? r.value?.normalizedValue ?? r.value?.rawOcrValue ?? "",
    confirmed: r.value?.finalValue != null,
  }));
  const jsonPreview = JSON.stringify(Object.fromEntries(rows.map((r) => [r.dataKey, r.value?.finalValue ?? null])), null, 2);

  const boxedFieldValues = processed ? doc.fieldValues.filter((v) => v.field && v.field.pageNo === 1) : [];

  const canRerunOcr = doc.status === "received" || doc.status === "error";

  // 프로토타입 outputDialog의 page-mode 비율 골격(좌 45:우 55 → 우측 58:42, 상하 22px)은
  // 그대로 두되, 카드 최대폭은 1320px → 1680px로 넓혔다 — 넓은 화면에서 카드가 화면 대비
  // 작아 보이고 오른쪽 패널 글자가 너무 작다는 피드백 반영(2026-08-20). 이 앱은 상단 전역
  // 헤더가 아니라 좌측 사이드바 구조라 프로토타입의 "calc(100vh - 162px)" 대신, 이미
  // h-screen인 Shell 콘텐츠 영역을 그대로 채우는 h-full로 대응한다.
  return (
    <div className="h-full box-border bg-[#eef2f6] py-[22px] px-[max(24px,calc((100%-1680px)/2))] overflow-auto">
      <div className="mx-auto w-full max-w-[1680px] h-full min-h-[560px] flex flex-col rounded-xl border border-[#d9e1e9] bg-white shadow-[0_8px_24px_rgba(32,54,78,0.07)] overflow-hidden">
        {/* 상단 액션 바 — 문서명/상태/AI OCR 실행/JSON/CSV/Excel/최종 확정 */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)]">
          <div>
            <div className="text-xs text-slate-400 tracking-wide">DOCUMENT DETAIL</div>
            <h1 className="text-lg font-semibold text-[var(--foreground)]">{doc.templateVersion.template.name}</h1>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {doc.status === "printed" && (
              <ButtonLabel variant="primary" className={busy !== null ? "opacity-50 pointer-events-none" : ""}>
                {busy === "import" ? "이미지 업로드 중…" : busy === "process" ? "AI 처리 중… (최대 2분)" : "+ AI OCR 실행"}
                <input type="file" accept="image/*" className="hidden" onChange={importAndRunOcr} disabled={busy !== null} />
              </ButtonLabel>
            )}
            {canRerunOcr && (
              <Button variant="primary" onClick={() => runAction("process")} disabled={busy !== null}>
                {busy === "process" ? "AI 처리 중… (최대 2분)" : "+ AI OCR 실행"}
              </Button>
            )}
            <Button onClick={() => setShowJson((v) => !v)} disabled={!processed}>
              JSON
            </Button>
            <Button
              disabled={!processed || busy !== null}
              onClick={async () => {
                setBusy("export-csv");
                const err = await downloadExport("csv", [documentId]);
                if (err) setActionError(err);
                setBusy(null);
              }}
            >
              CSV
            </Button>
            <Button
              disabled={!processed || busy !== null}
              onClick={async () => {
                setBusy("export-excel");
                const err = await downloadExport("excel", [documentId]);
                if (err) setActionError(err);
                setBusy(null);
              }}
            >
              Excel
            </Button>
            {doc.status === "review_required" ? (
              <Button variant="primary" onClick={() => runAction("confirm")} disabled={busy !== null}>
                최종 확정
              </Button>
            ) : doc.status === "confirmed" ? (
              <Button onClick={() => setShowReopen(true)}>재검수 열기</Button>
            ) : (
              <Button disabled>최종 확정</Button>
            )}
            {DEMO_MODE && hasSourceImage && (
              <Button onClick={() => runAction("demo-reprocess")} disabled={busy !== null} title="데모 전용 — 상태와 무관하게 AI OCR을 다시 돌립니다">
                {busy === "demo-reprocess" ? "다시 실행 중…" : "↻ 다시 실행 (데모)"}
              </Button>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 text-xs px-5 py-2 border-b border-[var(--color-border)]">
          <span className="text-slate-300 font-mono mr-1">{doc.ncode}</span>
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  s.state === "done"
                    ? "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-fg)] font-medium"
                    : s.state === "active"
                      ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-medium"
                      : "text-slate-400"
                }`}
              >
                {i + 1} {s.label}
              </span>
              {i < steps.length - 1 && <span className="text-slate-300">—</span>}
            </div>
          ))}
        </div>

        {actionError && (
          <p className="shrink-0 text-sm text-red-600 bg-red-50 border-b border-red-200 px-5 py-2">{actionError}</p>
        )}

        {showReopen && (
          <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-[var(--color-border)] bg-slate-50">
            <Input
              className="flex-1"
              placeholder="재검수 사유"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={async () => {
                if (!reopenReason.trim()) return;
                await runAction("reopen", { reason: reopenReason });
                setShowReopen(false);
                setReopenReason("");
              }}
            >
              확인
            </Button>
            <Button onClick={() => setShowReopen(false)}>취소</Button>
          </div>
        )}

        {/* 본문 — 좌 45%(작성 원본) : 우 55%(인식된 필드값 58% + CSV 자동 생성 42%) */}
        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "45% 55%", gridTemplateRows: "minmax(0, 1fr)" }}>
          <section className="min-w-0 flex flex-col bg-[#e8edf2] border-r border-[var(--color-border)]">
            <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-[#e1e6eb]">
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {hasSourceImage ? "작성 원본" : doc.status === "printed" ? "작성 원본 대기 중" : templatePdfBuffer ? "빈 원본 양식" : "작성 원본"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {hasSourceImage
                    ? "스마트펜 필기 원본 · 1페이지"
                    : doc.status === "printed"
                      ? "필기 이미지를 업로드하면 여기에 원본이 표시됩니다"
                      : templatePdfBuffer
                        ? "아직 필기 이미지가 없어 양식 원본을 보여줍니다 · 1페이지"
                        : "작성 원본 이미지가 없습니다"}
                </div>
              </div>
              {(hasSourceImage || (templatePdfBuffer && doc.status !== "printed")) && (
                <div className="flex items-center gap-1.5">
                  <button
                    className="border border-[#cbd6e2] rounded bg-white px-2 py-1.5 text-sm text-[#47627f] cursor-pointer"
                    onClick={() => setZoom((z) => Math.max(30, z - 5))}
                    title="축소"
                  >
                    −
                  </button>
                  <b className="text-xs text-[#536479] min-w-10 text-center tabular-nums">{zoom}%</b>
                  <button
                    className="border border-[#cbd6e2] rounded bg-white px-2 py-1.5 text-sm text-[#47627f] cursor-pointer"
                    onClick={() => setZoom((z) => Math.min(200, z + 5))}
                    title="확대"
                  >
                    ＋
                  </button>
                  {doc.status === "printed" && (
                    <ButtonLabel variant="primary">
                      ↑ 원본 업로드
                      <input type="file" accept="image/*" className="hidden" onChange={importFile} disabled={busy !== null} />
                    </ButtonLabel>
                  )}
                </div>
              )}
            </div>

            {/* test-source-viewport: 체크무늬 배경 위에 원본 문서를 패널 폭 기준(zoom=100%=꽉 참)으로 표시, 내부 스크롤 */}
            <div
              ref={sourceViewportRef}
              className="flex-1 min-h-0 overflow-auto relative bg-[#dfe5eb]"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#d4dbe2 25%,transparent 25%),linear-gradient(-45deg,#d4dbe2 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d4dbe2 75%),linear-gradient(-45deg,transparent 75%,#d4dbe2 75%)",
                backgroundSize: "14px 14px",
                backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0",
              }}
            >
              <div className="w-max min-w-full min-h-full p-[22px] grid place-items-start justify-center">
                {hasSourceImage ? (
                  <div
                    className="relative bg-white shadow-[0_12px_34px_rgba(34,51,72,0.21)] shrink-0"
                    style={{ width: sourcePanelWidth * (zoom / 100) }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 사용자가 올린 원본 스캔 이미지, next/image 최적화 대상 아님 */}
                    <img
                      src={`/api/documents/${documentId}/page-image/0?v=${encodeURIComponent(doc.receivedAt ?? "")}`}
                      alt="작성 원본"
                      className="block w-full h-auto bg-white"
                      draggable={false}
                    />
                    <div className="absolute inset-0 z-[5]">
                      {boxedFieldValues.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => focusKey(v.id)}
                          className={`absolute border text-[9px] px-0.5 overflow-hidden text-left cursor-pointer ${
                            activeKey === v.id
                              ? "border-[3px] border-[#1668e3] bg-[#1668e31c] shadow-[0_0_0_3px_#fff,0_0_0_5px_#1668e3]"
                              : rowStatusOf(v) === "issue" || rowStatusOf(v) === "review"
                                ? "border-[var(--color-status-amber-fg)] bg-[var(--color-status-amber-bg)]/40"
                                : "border-transparent hover:border-[#76a8e7] hover:bg-[#1768d710]"
                          }`}
                          style={{
                            left: `${v.field!.boxX * 100}%`,
                            top: `${v.field!.boxY * 100}%`,
                            width: `${v.field!.boxW * 100}%`,
                            height: `${v.field!.boxH * 100}%`,
                          }}
                          title={v.field!.label}
                        />
                      ))}
                    </div>
                  </div>
                ) : doc.status === "printed" ? (
                  // "빈 양식 미리보기"는 점선 박스만 떠 있어 렌더링이 깨진 것처럼 보인다는
                  // 피드백(2026-08-20)으로, 검토할 내용이 없는 이 상태에선 미리보기 대신
                  // 명확한 업로드 유도 화면만 보여준다.
                  <div className="w-full max-w-md flex flex-col items-center justify-center gap-4 bg-white text-center shrink-0 rounded-xl border border-dashed border-[#c7d2de] py-16 px-8">
                    <span className="text-4xl">✎</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">아직 필기 이미지가 없습니다</p>
                      <p className="text-xs text-slate-400 mt-1">스마트펜으로 작성한 필기 이미지를 업로드하면 AI OCR을 바로 실행할 수 있습니다.</p>
                    </div>
                    <ButtonLabel variant="primary" className={busy !== null ? "opacity-50 pointer-events-none" : ""}>
                      {busy === "import" ? "이미지 업로드 중…" : busy === "process" ? "AI 처리 중… (최대 2분)" : "↑ 필기 이미지 업로드 + AI OCR 실행"}
                      <input type="file" accept="image/*" className="hidden" onChange={importAndRunOcr} disabled={busy !== null} />
                    </ButtonLabel>
                  </div>
                ) : templatePdfBuffer ? (
                  <div className="relative bg-white shadow-[0_12px_34px_rgba(34,51,72,0.21)] shrink-0">
                    <PdfPageCanvas pdfBuffer={templatePdfBuffer} pageNo={1} width={Math.round(sourcePanelWidth * (zoom / 100))} onSize={setTemplatePdfSize} />
                    <div className="absolute inset-0 z-[5]">
                      {doc.templateVersion.fields
                        .filter((f) => f.pageNo === 1)
                        .map((f) => (
                          <div
                            key={f.id}
                            className="absolute border-2 border-dashed border-slate-400 bg-white/30"
                            style={{ left: `${f.boxX * 100}%`, top: `${f.boxY * 100}%`, width: `${f.boxW * 100}%`, height: `${f.boxH * 100}%` }}
                            title={f.label}
                          />
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-[380px] h-[540px] flex flex-col items-center justify-center gap-3 bg-white text-center shrink-0">
                    <span className="text-3xl">📄</span>
                    <p className="text-xs text-slate-500 px-6">작성 원본 이미지가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 h-8 flex items-center justify-between px-3 bg-white border-t border-[#dce2e8] text-xs text-[#657487]">
              <span>◱ 오른쪽 필드값을 누르면 원본 위치가 표시됩니다.</span>
              <span className="text-[#8a96a3]">JPG · PNG · 단일 페이지 PDF</span>
            </div>
          </section>

          {/* 우측 컬럼 — 58%(인식된 필드값) : 42%(CSV 자동 생성) */}
          <div className="min-w-0 min-h-0 grid" style={{ gridTemplateRows: "58% 42%" }}>
            <section className="min-h-0 flex flex-col overflow-hidden bg-[#f8fafb]">
              <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 border-b border-[#e1e6eb] bg-white">
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">인식된 필드값</div>
                  <div className="text-xs text-slate-400 mt-0.5">OCR 결과를 확인·수정한 후 최종 확정합니다.</div>
                </div>
                {canRerunOcr && (
                  <button
                    className="border border-[#cbd6e2] rounded bg-white px-2.5 py-1.5 text-xs text-[#47627f] cursor-pointer disabled:opacity-50"
                    onClick={() => runAction("process")}
                    disabled={busy !== null}
                  >
                    ↻ OCR 다시 실행
                  </button>
                )}
              </div>
              <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[#e1e6eb] bg-white flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="rounded-full px-2 py-1 bg-[#f1f4f7] text-[#687687]">
                    전체 <b className="text-[var(--foreground)]">{reviewCounts.all}</b>
                  </span>
                  <span className="rounded-full px-2 py-1 bg-[#eaf8f2] text-[#147857]">
                    완료 <b>{reviewCounts.done}</b>
                  </span>
                  <span className="rounded-full px-2 py-1 bg-[#fff5d9] text-[#9a6b00]">
                    확인 필요 <b>{reviewCounts.review}</b>
                  </span>
                  <span className="rounded-full px-2 py-1 bg-[#ffeded] text-[#b34040]">
                    미입력·오류 <b>{reviewCounts.issue}</b>
                  </span>
                </div>
                <div className="flex gap-1">
                  {(["all", "review", "issue"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setReviewFilter(f)}
                      className={`text-xs rounded-full px-2 py-1 font-medium cursor-pointer ${
                        reviewFilter === f ? "bg-[#172842] text-white" : "text-[#7d8996] hover:bg-slate-100"
                      }`}
                    >
                      {f === "all" ? "전체" : f === "review" ? "확인 필요" : "미입력·오류"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#e4e8ec]">
                {filteredRows.map((r) => (
                  <FieldRow
                    key={r.key}
                    row={r}
                    status={rowStatuses.get(r.key) as RowStatus}
                    active={activeKey === r.key}
                    onSave={saveFinalValue}
                    onFocus={() => focusKey(r.key)}
                  />
                ))}
                {filteredRows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">해당하는 필드가 없습니다.</p>}
              </div>
              {showJson && (
                <pre className="shrink-0 max-h-32 overflow-auto bg-slate-900 text-slate-100 text-[10px] p-3 leading-relaxed">{jsonPreview}</pre>
              )}
            </section>

            <section className="min-h-0 min-w-0 flex flex-col overflow-hidden bg-white border-t border-[#dce2e8]">
              <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 border-b border-[#e1e6eb]">
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">CSV 자동 생성</div>
                  <div className="text-xs text-slate-400 mt-0.5">데이터 키가 열 이름으로 사용됩니다.</div>
                </div>
                <span className="text-xs text-[#1768d7]">{csvEntries.length}개 열 · 1건</span>
              </div>
              <div className="flex-1 min-h-0 min-w-0 m-3 flex flex-col border border-[#dbe1e7] rounded-md overflow-hidden">
                <div
                  ref={csvScrollRef}
                  className="flex-1 min-h-0 min-w-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <table className="text-sm min-w-full">
                  <thead className="bg-slate-50 text-slate-400 sticky top-0">
                    <tr>
                      {csvEntries.map((e) => (
                        <th key={e.key} className="px-3 py-2 font-medium whitespace-nowrap text-left">
                          {e.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {csvEntries.map((e) => (
                        <td
                          key={e.key}
                          className={`px-3 py-2 whitespace-nowrap ${e.confirmed ? "text-slate-700 bg-white" : "text-slate-400 italic bg-amber-50/60"}`}
                          title={e.sample && !e.confirmed ? "AI 인식값 미리보기 — 아직 확정 전이라 다운로드에는 포함되지 않습니다" : undefined}
                        >
                          {e.sample || "—"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                  </table>
                </div>
                {csvScrollMetrics.scrollWidth > csvScrollMetrics.clientWidth + 1 && (
                  <CsvHorizontalScrollbar containerRef={csvScrollRef} metrics={csvScrollMetrics} />
                )}
              </div>
              <div className="shrink-0 flex items-center gap-1.5 px-3.5 pb-2.5 text-xs text-[#197c5d]">
                <span className="rounded-full px-2 py-1 bg-[#ecf8f3]">✓ UTF-8 BOM</span>
                <span className="rounded-full px-2 py-1 bg-[#ecf8f3]">✓ 일본어 지원</span>
                <span className="rounded-full px-2 py-1 bg-[#ecf8f3]">✓ 확정값 기준</span>
                {csvEntries.some((e) => e.sample && !e.confirmed) && (
                  <span className="text-slate-400">회색 기울임 = AI 인식값(미확정, 다운로드 미포함)</span>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 border-t border-[var(--color-border)] bg-white">
          <Button onClick={() => router.push("/documents")}>← 이전 화면으로</Button>
          {!processed && <span className="text-xs text-slate-400">AI OCR을 실행하면 인식된 값이 여기에 적용됩니다.</span>}
          <div className="flex-1" />
          <Link href="/documents" className="text-xs text-slate-400 hover:underline">
            문서 조회 전체 →
          </Link>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  row,
  status,
  active,
  onSave,
  onFocus,
}: {
  row: { key: string; label: string; required: boolean; dataKey: string; type: FieldType; value: DocumentDetailDTO["fieldValues"][number] | null };
  status: RowStatus;
  active: boolean;
  onSave: (id: string, finalValue: string | null) => void;
  onFocus: () => void;
}) {
  // 아직 최종 확정 전(finalValue 없음)이면 AI가 읽은 값(normalizedValue → rawOcrValue
  // 순으로)을 먼저 보여준다 — 검수 화면인데 인식값이 안 보이면 뭘 확인하라는 건지
  // 알 수 없다.
  const [local, setLocal] = useState(row.value?.finalValue ?? row.value?.normalizedValue ?? row.value?.rawOcrValue ?? "");
  const meta = ROW_STATUS_META[status];
  const disabled = !row.value;

  return (
    <div
      id={`field-row-${row.key}`}
      onClick={onFocus}
      className={`grid items-center gap-3 px-3.5 py-2.5 cursor-pointer border-l-[3px] ${
        active
          ? "border-l-[#1668e3] bg-[#eef5ff]"
          : status === "issue"
            ? "border-l-transparent bg-red-50/60"
            : status === "review"
              ? "border-l-transparent bg-[var(--color-status-amber-bg)]/40"
              : "border-l-transparent hover:bg-[#f7faff]"
      }`}
      style={{ gridTemplateColumns: "1fr 160px 84px" }}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">
          {row.label}
          {row.required && <span className="text-red-500"> *</span>}
        </div>
        <div className="text-xs text-slate-400 font-mono truncate">
          {row.dataKey} · {FIELD_TYPE_LABEL[row.type]}
        </div>
      </div>
      <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
        {!row.value ? (
          <Input className="w-full" placeholder={placeholderFor(row.type)} disabled />
        ) : row.type === "check" ? (
          <Select
            className="w-full"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onSave(row.value!.id, e.target.value || null);
            }}
          >
            <option value="">(미기재)</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        ) : row.type === "date" ? (
          <Input
            type="date"
            className="w-full"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onSave(row.value!.id, e.target.value || null);
            }}
          />
        ) : row.type === "time" ? (
          <Input
            type="time"
            className="w-full"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              onSave(row.value!.id, e.target.value || null);
            }}
          />
        ) : row.type === "choice" ? (
          <ChoiceValueInput
            options={(row.value.field?.choiceOptions ?? []).map((o) => o.storedValue)}
            mode={(row.value.field ?? row.value.repeatColumn)?.config.choice?.mode ?? "single"}
            value={local}
            onChange={(v) => {
              setLocal(v);
              onSave(row.value!.id, v || null);
            }}
          />
        ) : (
          <Input
            className="w-full"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onSave(row.value!.id, local || null)}
          />
        )}
      </div>
      <span className={`shrink-0 text-center text-xs rounded-full px-2 py-1 font-medium ${meta.className}`}>{meta.label}</span>
      <span className="sr-only">{disabled}</span>
      {row.value && row.value.reviewReasons.length > 0 && (
        <div className="text-xs text-[var(--color-status-amber-fg)] bg-[#fff7df] rounded px-2 py-1" style={{ gridColumn: "1 / 4" }}>
          {row.value.reviewReasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}
        </div>
      )}
    </div>
  );
}

// 브라우저/OS 스크롤바 렌더링(오버레이 자동 숨김 등)에 기대지 않고, 테이블 바로 아래에
// 항상 보이는 트랙+썸을 직접 그린다 — CSS ::-webkit-scrollbar 커스터마이즈가 이 환경에서
// 먹히지 않아(2026-08-20) 아예 우리가 그리는 스크롤바로 바꿨다. 드래그·트랙 클릭 둘 다 지원.
function CsvHorizontalScrollbar({
  containerRef,
  metrics,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  metrics: { scrollLeft: number; scrollWidth: number; clientWidth: number };
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollLeft, scrollWidth, clientWidth } = metrics;
  const trackWidth = trackRef.current?.clientWidth ?? clientWidth;
  const thumbWidth = Math.max(24, (clientWidth / scrollWidth) * trackWidth);
  const maxScroll = scrollWidth - clientWidth;
  const thumbLeft = maxScroll > 0 ? (scrollLeft / maxScroll) * (trackWidth - thumbWidth) : 0;

  function scrollToClientX(clientX: number) {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left - thumbWidth / 2) / (rect.width - thumbWidth)));
    container.scrollLeft = ratio * maxScroll;
  }

  function onThumbPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    function onMove(ev: PointerEvent) {
      scrollToClientX(ev.clientX);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={trackRef}
      className="shrink-0 h-3 bg-slate-100 border-t border-[#dbe1e7] relative cursor-pointer select-none"
      onClick={(e) => scrollToClientX(e.clientX)}
    >
      <div
        onPointerDown={onThumbPointerDown}
        className="absolute top-0.5 h-2 bg-slate-400 hover:bg-slate-500 rounded-full cursor-grab active:cursor-grabbing"
        style={{ left: thumbLeft, width: thumbWidth }}
      />
    </div>
  );
}

function placeholderFor(type: FieldType): string {
  if (type === "date") return "년.월.일.";
  if (type === "time") return "--:--";
  if (type === "number") return "0";
  return "";
}

function ChoiceValueInput({
  options,
  mode,
  value,
  onChange,
}: {
  options: string[];
  mode: "single" | "multiple";
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = value ? value.split(",").map((s) => s.trim()) : [];
  if (mode === "single") {
    return (
      <Select className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(미기재)</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(o)}
            onChange={(e) => {
              const next = e.target.checked ? [...selected, o] : selected.filter((s) => s !== o);
              onChange(next.join(", "));
            }}
          />
          {o}
        </label>
      ))}
      {options.length === 0 && <span className="text-xs text-slate-400">선택지가 정의되지 않았습니다.</span>}
    </div>
  );
}

function describeError(json: { error?: string }): string {
  if (json.error === "INVALID_TRANSITION") return "지금 상태에서는 이 동작을 할 수 없습니다.";
  if (json.error === "VALIDATION_FAILED") return "확인이 필요한 값이 남아 있어 확정할 수 없습니다. 아래 표에서 강조된 항목을 채우세요.";
  return "작업을 처리하지 못했습니다.";
}
