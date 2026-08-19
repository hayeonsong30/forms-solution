"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";

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

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocuments);
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">문서 조회</h1>
        <Link href="/templates" className="text-sm text-blue-600 hover:underline">
          양식 관리 →
        </Link>
      </div>

      <ul className="divide-y border rounded">
        {documents.map((d) => (
          <li key={d.id} className="px-4 py-3">
            <Link href={`/documents/${d.id}`} className="font-medium hover:underline">
              {d.templateVersion.template.name}
            </Link>
            <div className="text-xs text-gray-500">
              {d.ncode} · {STATUS_LABEL[d.status]} · {new Date(d.createdAt).toLocaleString("ko-KR")}
            </div>
          </li>
        ))}
        {documents.length === 0 && <li className="px-4 py-6 text-sm text-gray-500">아직 문서가 없습니다.</li>}
      </ul>
    </main>
  );
}
