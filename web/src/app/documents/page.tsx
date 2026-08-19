"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";
import { downloadExport } from "@/lib/downloadExport";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  printed: "인쇄됨",
  received: "필기 수신",
  processing: "처리 중",
  review_required: "검수 필요",
  confirmed: "확정",
  error: "오류",
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
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">문서 조회</h1>
        <Link href="/templates" className="text-sm text-blue-600 hover:underline">
          양식 관리 →
        </Link>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">{selected.length}건 선택됨</span>
          <button
            className="text-sm border rounded px-3 py-1 disabled:opacity-50"
            onClick={() => exportSelected("csv")}
            disabled={exporting !== null}
          >
            {exporting === "csv" ? "생성 중…" : "CSV 다운로드"}
          </button>
          <button
            className="text-sm border rounded px-3 py-1 disabled:opacity-50"
            onClick={() => exportSelected("excel")}
            disabled={exporting !== null}
          >
            {exporting === "excel" ? "생성 중…" : "Excel 다운로드"}
          </button>
          {exportError && <span className="text-xs text-red-600">{exportError}</span>}
        </div>
      )}

      <ul className="divide-y border rounded">
        {documents.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            {d.status === "confirmed" && (
              <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
            )}
            <div className="flex-1">
              <Link href={`/documents/${d.id}`} className="font-medium hover:underline">
                {d.templateVersion.template.name}
              </Link>
              <div className="text-xs text-gray-500">
                {d.ncode} · {STATUS_LABEL[d.status]} · {new Date(d.createdAt).toLocaleString("ko-KR")}
              </div>
            </div>
          </li>
        ))}
        {documents.length === 0 && <li className="px-4 py-6 text-sm text-gray-500">아직 문서가 없습니다.</li>}
      </ul>
    </main>
  );
}
