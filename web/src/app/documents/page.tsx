"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";
import { downloadExport } from "@/lib/downloadExport";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

const STATUS: Record<DocumentStatus, { label: string; tone: "amber" | "green" | "slate" | "red" | "brand" }> = {
  printed: { label: "인쇄됨", tone: "slate" },
  received: { label: "작성", tone: "slate" },
  processing: { label: "처리 중", tone: "brand" },
  review_required: { label: "확인 필요", tone: "amber" },
  confirmed: { label: "완료", tone: "green" },
  error: { label: "오류", tone: "red" },
};

type FilterTab = "all" | DocumentStatus;

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentListItemDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "excel" | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocuments);
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
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="문서 조회"
        actions={
          selected.length > 0 ? (
            <>
              <span className="text-sm text-slate-400 mr-1">{selected.length}건 선택됨</span>
              <Button onClick={() => exportSelected("csv")} disabled={exporting !== null}>
                {exporting === "csv" ? "생성 중…" : "CSV 다운로드"}
              </Button>
              <Button onClick={() => exportSelected("excel")} disabled={exporting !== null}>
                {exporting === "excel" ? "생성 중…" : "Excel 다운로드"}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <SummaryCard label="전체 문서" value={summary.total} />
        <SummaryCard label="인쇄" value={summary.printed} />
        <SummaryCard label="작성" value={summary.writing} tone="amber" />
        <SummaryCard label="완료" value={summary.confirmed} tone="green" />
      </div>

      {exportError && <p className="text-sm text-red-600 mb-4">{exportError}</p>}

      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm w-64">
          <span className="text-slate-400">⌕</span>
          <input
            className="flex-1 outline-none"
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
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium w-8" />
              <th className="px-4 py-2.5 font-medium">양식</th>
              <th className="px-4 py-2.5 font-medium">페이지</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">확인 필요 / 반복행</th>
              <th className="px-4 py-2.5 font-medium">일시</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.map((d) => {
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
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.templateVersion.template.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{d.ncode}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.templateVersion.pageCount}</td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {d.needsReviewCount > 0 && <span className="text-[var(--color-status-amber-fg)]">확인 {d.needsReviewCount}건</span>}
                    {d.needsReviewCount > 0 && d.repeatRowCount > 0 && " · "}
                    {d.repeatRowCount > 0 && <span>행 {d.repeatRowCount}개</span>}
                    {d.needsReviewCount === 0 && d.repeatRowCount === 0 && "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(d.createdAt).toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3">
                    <Link href={`/documents/${d.id}`}>
                      <Button>조회</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
