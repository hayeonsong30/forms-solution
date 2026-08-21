"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DocumentListItem = {
  id: string;
  ncode: string | null;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
  templateVersion: { template: { id: string; name: string } };
};

const STATUS_LABEL: Record<string, string> = {
  printed: "인쇄됨",
  received: "필기 수신",
  processing: "처리 중",
  review_required: "검수 필요",
  confirmed: "확정",
  error: "오류",
};

export default function SimpleDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
      .then(setDocuments);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-lg font-semibold text-slate-900 mb-6">문서 조회</h1>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">문서번호</th>
              <th className="px-4 py-2.5 font-medium">양식명</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">등록일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((d) => (
              <tr key={d.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/simple/documents/${d.id}`)}>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.ncode}</td>
                <td className="px-4 py-3 text-slate-700">{d.templateVersion.template.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{STATUS_LABEL[d.status] ?? d.status}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(d.createdAt).toLocaleDateString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {documents.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-400">등록된 문서가 없습니다.</div>}
      </div>
    </div>
  );
}
