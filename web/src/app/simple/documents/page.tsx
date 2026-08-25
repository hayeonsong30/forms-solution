"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentListItemDTO } from "@/types";
import { PenConnectPanel } from "@/components/PenConnectPanel";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    title: "문서 조회",
    importPen: "↑ 펜 데이터 가져오기",
    status: {
      printed: "인쇄됨",
      received: "필기 수신",
      processing: "처리 중",
      review_required: "검수 필요",
      confirmed: "확정",
      error: "오류",
    } as Record<string, string>,
    table: { docNo: "문서번호", form: "양식명", status: "상태", registeredAt: "등록일" },
    empty: "등록된 문서가 없습니다.",
  },
  ja: {
    title: "文書照会",
    importPen: "↑ ペンデータの取り込み",
    status: {
      printed: "印刷済み",
      received: "筆記受信",
      processing: "処理中",
      review_required: "確認必要",
      confirmed: "確定",
      error: "エラー",
    } as Record<string, string>,
    table: { docNo: "文書番号", form: "様式名", status: "状態", registeredAt: "登録日" },
    empty: "登録された文書がありません。",
  },
} satisfies Record<Lang, { title: string; importPen: string; status: Record<string, string>; table: { docNo: string; form: string; status: string; registeredAt: string }; empty: string }>;

export default function SimpleDocumentsPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [documents, setDocuments] = useState<DocumentListItemDTO[]>([]);
  const [showPenPanel, setShowPenPanel] = useState(false);

  const refresh = () => fetch("/api/documents").then((r) => r.json()).then(setDocuments);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-slate-900">{s.title}</h1>
        <button
          onClick={() => setShowPenPanel(true)}
          className="text-sm font-medium rounded-lg px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
        >
          {s.importPen}
        </button>
      </div>

      {showPenPanel && (
        <PenConnectPanel
          onClose={() => setShowPenPanel(false)}
          onImported={() => {
            setShowPenPanel(false);
            refresh();
          }}
        />
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">{s.table.docNo}</th>
              <th className="px-4 py-2.5 font-medium">{s.table.form}</th>
              <th className="px-4 py-2.5 font-medium">{s.table.status}</th>
              <th className="px-4 py-2.5 font-medium">{s.table.registeredAt}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((d) => (
              <tr key={d.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/simple/documents/${d.id}`)}>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.ncode}</td>
                <td className="px-4 py-3 text-slate-700">{d.templateVersion.template.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.status[d.status] ?? d.status}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(d.createdAt).toLocaleDateString(lang === "ja" ? "ja-JP" : "ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {documents.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-400">{s.empty}</div>}
      </div>
    </div>
  );
}
