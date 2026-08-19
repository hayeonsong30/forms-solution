"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";
import { downloadExport } from "@/lib/downloadExport";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

const STATUS: Record<DocumentStatus, { label: string; tone: "amber" | "green" | "slate" | "red" | "brand" }> = {
  printed: { label: "인쇄됨", tone: "slate" },
  received: { label: "필기 수신", tone: "slate" },
  processing: { label: "처리 중", tone: "brand" },
  review_required: { label: "검수 필요", tone: "amber" },
  confirmed: { label: "확정", tone: "green" },
  error: { label: "오류", tone: "red" },
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentListItemDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "excel" | null>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocuments);
  }, []);

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
    <div className="mx-auto max-w-3xl px-8 py-8">
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

      {exportError && <p className="text-sm text-red-600 mb-4">{exportError}</p>}

      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {documents.map((d) => {
            const status = STATUS[d.status];
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                {d.status === "confirmed" ? (
                  <input
                    type="checkbox"
                    className="accent-[var(--color-brand-600)]"
                    checked={selected.includes(d.id)}
                    onChange={() => toggle(d.id)}
                  />
                ) : (
                  <span className="w-4" />
                )}
                <div className="flex-1">
                  <Link href={`/documents/${d.id}`} className="font-medium text-sm hover:text-[var(--color-brand-600)]">
                    {d.templateVersion.template.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 font-mono">{d.ncode}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleString("ko-KR")}</span>
                  </div>
                </div>
              </li>
            );
          })}
          {documents.length === 0 && (
            <li>
              <EmptyState>아직 문서가 없습니다.</EmptyState>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
