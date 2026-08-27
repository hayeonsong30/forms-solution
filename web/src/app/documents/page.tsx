"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";
import { downloadExport } from "@/lib/downloadExport";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { PenConnectPanel } from "@/components/PenConnectPanel";
import { useLanguage, type Lang } from "@/lib/language";

const STATUS_LABELS: Record<Lang, Record<DocumentStatus, string>> = {
  ko: {
    printed: "인쇄됨",
    received: "작성",
    processing: "처리 중",
    review_required: "작성",
    confirmed: "완료",
    error: "오류",
  },
  ja: {
    printed: "印刷済み",
    received: "作成",
    processing: "処理中",
    review_required: "作成",
    confirmed: "完了",
    error: "エラー",
  },
};

const STATUS_TONE: Record<DocumentStatus, "amber" | "green" | "slate" | "red" | "brand"> = {
  printed: "slate",
  received: "slate",
  processing: "brand",
  review_required: "slate",
  confirmed: "green",
  error: "red",
};

const STRINGS = {
  ko: {
    title: "문서 조회",
    selectedCount: (n: number) => `${n}건 선택됨`,
    generating: "생성 중…",
    downloadCsv: "CSV 다운로드",
    downloadExcel: "Excel 다운로드",
    importFromPen: "↑ 펜 데이터 가져오기",
    summaryTotal: "전체 문서",
    summaryPrinted: "인쇄",
    summaryWriting: "작성",
    summaryConfirmed: "완료",
    searchPlaceholder: "문서 번호·양식명 검색",
    tabAll: "전체",
    colTemplateId: "양식 ID",
    colPageCount: "페이지",
    colOwner: "소유자",
    colStatus: "상태",
    colDate: "인쇄 / 작성 일시",
    view: "조회",
    emptyState: "조건에 맞는 문서가 없습니다.",
    templateManage: "양식 관리 →",
    ownerName: "데모 관리자",
  },
  ja: {
    title: "文書照会",
    selectedCount: (n: number) => `${n}件選択中`,
    generating: "生成中…",
    downloadCsv: "CSVダウンロード",
    downloadExcel: "Excelダウンロード",
    importFromPen: "↑ ペンデータ取り込み",
    summaryTotal: "全体文書",
    summaryPrinted: "印刷",
    summaryWriting: "作成",
    summaryConfirmed: "完了",
    searchPlaceholder: "文書番号・様式名で検索",
    tabAll: "すべて",
    colTemplateId: "様式ID",
    colPageCount: "ページ",
    colOwner: "所有者",
    colStatus: "状態",
    colDate: "印刷／作成日時",
    view: "照会",
    emptyState: "条件に一致する文書がありません。",
    templateManage: "様式管理 →",
    ownerName: "デモ管理者",
  },
} satisfies Record<
  Lang,
  {
    title: string;
    selectedCount: (n: number) => string;
    generating: string;
    downloadCsv: string;
    downloadExcel: string;
    importFromPen: string;
    summaryTotal: string;
    summaryPrinted: string;
    summaryWriting: string;
    summaryConfirmed: string;
    searchPlaceholder: string;
    tabAll: string;
    colTemplateId: string;
    colPageCount: string;
    colOwner: string;
    colStatus: string;
    colDate: string;
    view: string;
    emptyState: string;
    templateManage: string;
    ownerName: string;
  }
>;

type FilterTab = "all" | DocumentStatus;

// Document에는 아직 작성자(로그인 사용자) 정보가 없다 — 로그인/세션이 생기기 전까지는
// 데모 관리자 계정으로 고정 표시한다 (사용자 결정, 2026-08-20).
const DEMO_OWNER_EMAIL = "demo-admin@neolab.local";

// "2026. 8. 20. 오후 3:00:44" 같은 로케일 문자열 대신 "2026-08-10 12:20:16" 형식으로
// 고정한다 — 사용자 요청(2026-08-20), 표에서 정렬·비교하기 쉬운 형태.
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function DocumentsPage() {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const statusLabels = STATUS_LABELS[lang];
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
      writing: documents.filter((d) => d.status === "received" || d.status === "processing" || d.status === "review_required").length,
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

  // 공유 SOBP로 여러 문서가 1행으로 묶인 경우, 체크박스 하나로 그룹 안의 문서 id 전부를
  // 같이 선택/해제한다(CSV·Excel 추출 대상이 그룹 전체가 되도록).
  function toggle(ids: string[]) {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      return allSelected ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])];
    });
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
        title={s.title}
        actions={
          <>
            {selected.length > 0 && (
              <>
                <span className="text-sm text-slate-400 mr-1">{s.selectedCount(selected.length)}</span>
                <Button onClick={() => exportSelected("csv")} disabled={exporting !== null}>
                  {exporting === "csv" ? s.generating : s.downloadCsv}
                </Button>
                <Button onClick={() => exportSelected("excel")} disabled={exporting !== null}>
                  {exporting === "excel" ? s.generating : s.downloadExcel}
                </Button>
              </>
            )}
            <Button variant="primary" onClick={() => setShowPenPanel(true)}>
              {s.importFromPen}
            </Button>
          </>
        }
      />

      {showPenPanel && (
        <PenConnectPanel
          onClose={() => setShowPenPanel(false)}
          onImported={() => {
            setShowPenPanel(false);
            refresh();
          }}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label={s.summaryTotal} value={summary.total} />
        <SummaryCard label={s.summaryPrinted} value={summary.printed} />
        <SummaryCard label={s.summaryWriting} value={summary.writing} tone="amber" />
        <SummaryCard label={s.summaryConfirmed} value={summary.confirmed} tone="green" />
      </div>

      {exportError && <p className="text-sm text-red-600 mb-4">{exportError}</p>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm w-full sm:w-64">
          <span className="text-slate-400">⌕</span>
          <input
            className="flex-1 outline-none min-w-0"
            placeholder={s.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex gap-1 flex-wrap">
          {(["all", "printed", "received", "confirmed"] as FilterTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm rounded-lg px-3 py-1.5 font-medium cursor-pointer ${
                tab === t ? "bg-[var(--color-brand-600)] text-white" : "border border-[var(--color-border)] bg-white hover:bg-slate-50"
              }`}
            >
              {t === "all" ? s.tabAll : statusLabels[t]}
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
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colTemplateId}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colPageCount}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colOwner}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colStatus}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colDate}</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.map((d, idx) => {
              const statusLabel = statusLabels[d.status];
              const statusTone = STATUS_TONE[d.status];
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {d.status === "confirmed" ? (
                      <input
                        type="checkbox"
                        className="accent-[var(--color-brand-600)]"
                        checked={d.groupIds.every((id) => selected.includes(id))}
                        onChange={() => toggle(d.groupIds)}
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
                  <td className="px-4 py-3 text-slate-500">{d.pageScanCount}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    <div>{s.ownerName}</div>
                    <div className="text-xs text-slate-400">{DEMO_OWNER_EMAIL}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone}>{statusLabel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono whitespace-nowrap">
                    <div>{formatDateTime(d.createdAt)}</div>
                    <div className="mt-0.5">{d.receivedAt ? formatDateTime(d.receivedAt) : "—"}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/documents/${d.groupIds[0]}`}>
                      <Button>{s.view}</Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <EmptyState>{s.emptyState}</EmptyState>}
      </Card>

      <p className="text-xs text-slate-400 mt-3">
        <Link href="/templates" className="hover:underline">
          {s.templateManage}
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
