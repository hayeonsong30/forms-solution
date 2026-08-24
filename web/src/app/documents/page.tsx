"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";
import { downloadExport } from "@/lib/downloadExport";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { PenConnectPanel } from "@/components/PenConnectPanel";

const STATUS: Record<DocumentStatus, { label: string; tone: "amber" | "green" | "slate" | "red" | "brand" }> = {
  printed: { label: "인쇄됨", tone: "slate" },
  received: { label: "작성", tone: "slate" },
  processing: { label: "처리 중", tone: "brand" },
  review_required: { label: "확인 필요", tone: "amber" },
  confirmed: { label: "완료", tone: "green" },
  error: { label: "오류", tone: "red" },
};

type FilterTab = "all" | DocumentStatus;

// Document에는 아직 작성자(로그인 사용자) 정보가 없다 — 로그인/세션이 생기기 전까지는
// 데모 관리자 계정으로 고정 표시한다 (사용자 결정, 2026-08-20).
const DEMO_OWNER = { name: "데모 관리자", email: "demo-admin@neolab.local" };

// "2026. 8. 20. 오후 3:00:44" 같은 로케일 문자열 대신 "2026-08-10 12:20:16" 형식으로
// 고정한다 — 사용자 요청(2026-08-20), 표에서 정렬·비교하기 쉬운 형태.
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentListItemDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "excel" | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [showPenPanel, setShowPenPanel] = useState(false);

  const refresh = () => fetch("/api/documents").then((r) => r.json()).then(setDocuments);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, []);

  const summary = useMemo(
    () => ({
      total: documents.length,
      printed: documents.filter((d) => d.status === "printed").length,
      writing: documents.filter((d) => d.status === "received" || d.status === "processing").length,
      review: documents.filter((d) => d.status === "review_required").length,
      confirmed: documents.filter((d) => d.status === "confirmed").length,
    }),
    [documents]
  );

  const filtered = documents
    .filter((d) => tab === "all" || d.status === tab)
    .filter(
      (d) =>
        query.trim() === "" ||
        d.templateVersion.template.name.toLowerCase().includes(query.toLowerCase()) ||
        (d.ncode ?? "").toLowerCase().includes(query.toLowerCase())
    );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function exportSelected(kind: "csv" | "excel") {
    if (selected.length === 0) return;
    setExportError(null);
    setExporting(kind);
    try {
      const error = await downloadExport(kind, selected);
      if (error) setExportError(error);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
      <PageHeader
        title="문서 조회"
        actions={
          <>
            {selected.length > 0 && (
              <>
                <span className="text-sm text-slate-400 mr-1">{selected.length}건 선택됨</span>
                <Button onClick={() => exportSelected("csv")} disabled={exporting !== null}>
                  {exporting === "csv" ? "생성 중…" : "CSV 다운로드"}
                </Button>
                <Button onClick={() => exportSelected("excel")} disabled={exporting !== null}>
                  {exporting === "excel" ? "생성 중…" : "Excel 다운로드"}
                </Button>
              </>
            )}
            <Button variant="primary" onClick={() => setShowPenPanel(true)}>
              ↑ 펜 데이터 가져오기
            </Button>
          </>
        }
      />

      {showPenPanel && (
        <PenConnectPanel
          documents={documents}
          onClose={() => setShowPenPanel(false)}
          onImported={(documentId) => {
            setShowPenPanel(false);
            router.push(`/documents/${documentId}`);
          }}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="전체 문서" value={summary.total} />
        <SummaryCard label="인쇄" value={summary.printed} />
        <SummaryCard label="작성" value={summary.writing} tone="amber" />
        <SummaryCard label="완료" value={summary.confirmed} tone="green" />
      </div>

      {exportError && <p className="text-sm text-red-600 mb-4">{exportError}</p>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm w-full sm:w-64">
          <span className="text-slate-400">⌕</span>
          <input
            className="flex-1 outline-none min-w-0"
            placeholder="문서 번호·양식명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex gap-1 flex-wrap">
          {(["all", "printed", "received", "review_required", "confirmed"] as FilterTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm rounded-lg px-3 py-1.5 font-medium cursor-pointer ${
                tab === t ? "bg-[var(--color-brand-600)] text-white" : "border border-[var(--color-border)] bg-white hover:bg-slate-50"
              }`}
            >
              {t === "all" ? "전체" : STATUS[t].label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium w-8 whitespace-nowrap" />
              <th className="px-4 py-2.5 font-medium w-10 whitespace-nowrap">No.</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">양식 ID</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">페이지</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">소유자</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">상태</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">인쇄 / 작성 일시</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.map((d, idx) => {
              const status = STATUS[d.status];
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {d.status === "confirmed" ? (
                      <input
                        type="checkbox"
                        className="accent-[var(--color-brand-600)]"
                        checked={selected.includes(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium font-mono text-xs" title={d.templateVersion.template.id}>
                      {d.templateVersion.template.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{d.ncode}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.templateVersion.pageCount}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    <div>{DEMO_OWNER.name}</div>
                    <div className="text-xs text-slate-400">{DEMO_OWNER.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono whitespace-nowrap">
                    <div>{formatDateTime(d.createdAt)}</div>
                    <div className="mt-0.5">{d.receivedAt ? formatDateTime(d.receivedAt) : "—"}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/documents/${d.id}`}>
                      <Button>조회</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <EmptyState>조건에 맞는 문서가 없습니다.</EmptyState>}
      </Card>

      <p className="text-xs text-slate-400 mt-3">
        <Link href="/templates" className="hover:underline">
          양식 관리 →
        </Link>
      </p>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "amber" | "green" }) {
  const toneClass =
    tone === "amber" ? "text-[var(--color-status-amber-fg)]" : tone === "green" ? "text-[var(--color-status-green-fg)]" : "";
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </Card>
  );
}
