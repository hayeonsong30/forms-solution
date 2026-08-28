"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TemplateListItemDTO } from "@/types";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { useLanguage, type Lang } from "@/lib/language";
import { DEMO_OWNER_EMAIL } from "@/lib/demoOwner";

const STRINGS = {
  ko: {
    pageTitle: "양식 관리",
    summaryTotal: "전체 양식",
    summaryDraft: "편집 중",
    summaryIssuedSobp: "발급된 SOBP",
    uploadBlank: "+ 빈 양식 업로드",
    blankTemplateName: "이름 없는 양식",
    confirmDelete: (name: string) => `"${name}" 양식을 삭제할까요? 되돌릴 수 없습니다.`,
    hasDocumentsError: (count: number) => `이미 발행된 문서가 ${count}건 있어 삭제할 수 없습니다.`,
    deleteDisabledHasDocuments: "이미 발행된 문서가 있어 삭제할 수 없습니다.",
    deleteFailed: "양식 삭제 실패",
    searchPlaceholder: "양식 ID·양식명 검색",
    tabAll: "전체",
    tabDraft: "편집 중",
    tabPrintable: "인쇄 가능",
    tabIssued: "발급 완료",
    colNo: "NO",
    colId: "ID",
    colName: "Name",
    colOwner: "Owner",
    colPage: "페이지",
    colCopies: "설정 부수",
    copiesValue: (n: number) => `${n}부`,
    colStatus: "상태",
    colCreatedAt: "등록일",
    colUpdatedAt: "수정일",
    colAction: "작업",
    statusDraft: "편집 중",
    statusPrintable: "인쇄 가능",
    statusIssued: "발급 완료",
    ownerName: "데모 관리자",
    print: "다운로드",
    reissue: "다시 받기",
    duplicate: "복제",
    delete: "삭제",
    emptyState: "등록된 양식이 없습니다.",
    viewDocuments: "문서 조회 →",
    printDialogTitle: "다운로드 설정",
    blueprintMode: "청사진 모드",
    blueprintModeDesc: "인쇄된 NCode 패턴과 구분하기 쉽게 문서 색상을 파란색으로 변환",
    dotSize: "NCode 점 크기",
    dotSizeDesc: "NCode 패턴 점 크기 조절 (0.1 ~ 2.0)",
    resetDefault: "기본값으로 재설정",
    printStatusInfo: (total: number) => `설정 부수: ${total}부`,
    cancel: "닫기",
    printing: "다운로드 준비 중…",
    printAction: "⬇ 다운로드",
    reissueAction: "🔁 다시 받기",
    reissuing: "다시 받는 중…",
    reissueNote: "이미 설정 부수만큼 전부 발급됐습니다. 새로 발급하지 않고 같은 내용을 다시 받습니다.",
    issueFailed: "발급에 실패했습니다. 다시 시도해주세요.",
    fileFailed: "SOBP는 발급됐지만 파일 다운로드에 실패했습니다. 아래 '다시 받기'로 다시 받아주세요.",
    reissueFailed: "다시 받기에 실패했습니다. 잠시 후 다시 시도해주세요.",
  },
  ja: {
    pageTitle: "フォーム管理",
    summaryTotal: "全体フォーム",
    summaryDraft: "編集中",
    summaryIssuedSobp: "発行済みSOBP",
    uploadBlank: "+ 空のフォームを作成",
    blankTemplateName: "名称未設定フォーム",
    confirmDelete: (name: string) => `「${name}」フォームを削除しますか？元に戻せません。`,
    hasDocumentsError: (count: number) => `すでに発行済みの文書が${count}件あるため削除できません。`,
    deleteDisabledHasDocuments: "すでに発行済みの文書があるため削除できません。",
    deleteFailed: "フォームの削除に失敗しました",
    searchPlaceholder: "フォームID・フォーム名で検索",
    tabAll: "すべて",
    tabDraft: "編集中",
    tabPrintable: "印刷可能",
    tabIssued: "発行完了",
    colNo: "NO",
    colId: "ID",
    colName: "Name",
    colOwner: "Owner",
    colPage: "ページ",
    colCopies: "設定部数",
    copiesValue: (n: number) => `${n}部`,
    colStatus: "ステータス",
    colCreatedAt: "登録日",
    colUpdatedAt: "更新日",
    colAction: "操作",
    statusDraft: "編集中",
    statusPrintable: "印刷可能",
    statusIssued: "発行完了",
    ownerName: "デモ管理者",
    print: "ダウンロード",
    reissue: "再取得",
    duplicate: "複製",
    delete: "削除",
    emptyState: "登録されたフォームがありません。",
    viewDocuments: "文書一覧 →",
    printDialogTitle: "ダウンロード設定",
    blueprintMode: "ブループリントモード",
    blueprintModeDesc: "印刷されたNCodeパターンと区別しやすいよう文書の色を青色に変換します",
    dotSize: "NCodeドットサイズ",
    dotSizeDesc: "NCodeパターンのドットサイズを調整（0.1〜2.0）",
    resetDefault: "デフォルトに戻す",
    printStatusInfo: (total: number) => `設定部数: ${total}部`,
    cancel: "閉じる",
    printing: "ダウンロード準備中…",
    printAction: "⬇ ダウンロード",
    reissueAction: "🔁 再取得",
    reissuing: "再取得中…",
    reissueNote: "すでに設定部数を全て発行済みです。新規発行はせず、同じ内容を再度お渡しします。",
    issueFailed: "発行に失敗しました。もう一度お試しください。",
    fileFailed: "SOBPは発行されましたが、ファイルのダウンロードに失敗しました。下の「再取得」からもう一度お試しください。",
    reissueFailed: "再取得に失敗しました。しばらくしてからもう一度お試しください。",
  },
} satisfies Record<Lang, unknown>;

const PRINT_SETTINGS_KEY = "formsolution.printSettings";
type PrintSettings = { blueprintMode: boolean; dotSize: number };
const DEFAULT_PRINT_SETTINGS: PrintSettings = { blueprintMode: true, dotSize: 0.5 };

function loadPrintSettings(): PrintSettings {
  if (typeof window === "undefined") return DEFAULT_PRINT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(PRINT_SETTINGS_KEY);
    return raw ? { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_PRINT_SETTINGS;
  } catch {
    return DEFAULT_PRINT_SETTINGS;
  }
}

type Org = { id: string; name: string };
type FilterTab = "all" | "draft" | "printable" | "issued";

function isFullyIssued(t: TemplateListItemDTO): boolean {
  return t.status === "printable" && Math.max(0, t.printCopies - t.printedCount) <= 0;
}

// 2026-08-20: 상태를 draft(편집 중) / printable(인쇄 가능) 단일 축으로 재설계했다.
// 상태 전환은 편집기 헤더 드롭다운에서 하고, 목록은 표시 전용이다.
export default function TemplatesPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [templates, setTemplates] = useState<TemplateListItemDTO[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<TemplateListItemDTO | null>(null);

  async function refresh() {
    const [t, o] = await Promise.all([
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/orgs").then((r) => r.json()),
    ]);
    setTemplates(t);
    setOrgs(o);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
  }, []);

  // PRD_양식편집기_상세 §8.0: "신규 양식의 초기 필드 수는 0개이며 양식명은 `이름 없는 양식`으로
  // 시작한다" — 이름을 물어보지 않고 바로 빈 편집기로 들어간다 (프로토타입의 openNewBlankEditor와 동일).
  async function createBlankTemplate() {
    if (orgs.length === 0 || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: orgs[0].id, name: s.blankTemplateName, pageCount: 1 }),
      });
      if (!res.ok) throw new Error("create failed");
      const created = await res.json();
      router.push(`/editor/${created.id}`);
    } finally {
      setCreating(false);
    }
  }

  // 인쇄 완료로 편집이 잠긴 양식을 고치고 싶을 때 쓰는 유일한 방법 — 필드·반복행·Excel
  // 템플릿까지 그대로 복사한 새 draft 양식을 만들어 그 편집기로 이동한다.
  async function duplicateTemplate(t: TemplateListItemDTO) {
    setDuplicatingId(t.id);
    try {
      const res = await fetch(`/api/templates/${t.id}/duplicate`, { method: "POST" });
      if (res.ok) {
        const created = await res.json();
        router.push(`/editor/${created.id}`);
      }
    } finally {
      setDuplicatingId(null);
    }
  }

  // 이미 발행된 문서가 있으면 서버가 409로 막는다 — 그 경우 사유를 그대로 보여준다.
  async function deleteTemplate(t: TemplateListItemDTO) {
    if (!window.confirm(s.confirmDelete(t.name))) return;
    setActionError(null);
    setDeletingId(t.id);
    try {
      const res = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
      if (res.ok) {
        await refresh();
        return;
      }
      const json = await res.json();
      setActionError(
        json.error === "TEMPLATE_HAS_DOCUMENTS"
          ? s.hasDocumentsError(json.documentCount)
          : s.deleteFailed
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = templates
    .filter((t) => {
      if (tab === "all") return true;
      if (tab === "printable") return t.status === "printable" && !isFullyIssued(t);
      if (tab === "issued") return isFullyIssued(t);
      return t.status === tab;
    })
    .filter(
      (t) =>
        query.trim() === "" ||
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.id.toLowerCase().includes(query.toLowerCase())
    );

  const summary = {
    total: templates.length,
    draft: templates.filter((t) => t.status === "draft").length,
    // Document 1건(=1부)이 그 양식의 페이지 수만큼 SOBP를 갖는다(페이지마다 SOBP 1개,
    // web/src/app/api/templates/[templateId]/documents/route.ts의 pageNcodes 참고) —
    // 그래서 발급된 SOBP 총량은 부수(printedCount)가 아니라 부수 × 페이지 수다.
    issuedSobp: templates.reduce((sum, t) => sum + t.printedCount * t.pageCount, 0),
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
      <PageHeader
        title={s.pageTitle}
        actions={
          <Button variant="primary" onClick={createBlankTemplate} disabled={creating}>
            {s.uploadBlank}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard label={s.summaryTotal} value={summary.total} />
        <SummaryCard label={s.summaryDraft} value={summary.draft} />
        <SummaryCard label={s.summaryIssuedSobp} value={summary.issuedSobp} tone="green" />
      </div>

      {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

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
          <FilterTabButton active={tab === "all"} onClick={() => setTab("all")}>
            {s.tabAll}
          </FilterTabButton>
          <FilterTabButton active={tab === "draft"} onClick={() => setTab("draft")}>
            {s.tabDraft}
          </FilterTabButton>
          <FilterTabButton active={tab === "printable"} onClick={() => setTab("printable")}>
            {s.tabPrintable}
          </FilterTabButton>
          <FilterTabButton active={tab === "issued"} onClick={() => setTab("issued")}>
            {s.tabIssued}
          </FilterTabButton>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium w-10 whitespace-nowrap">{s.colNo}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colId}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colName}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colOwner}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colPage}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colCopies}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colStatus}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colCreatedAt}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colUpdatedAt}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.map((t, idx) => (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={() => router.push(`/editor/${t.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/editor/${t.id}`);
                  }
                }}
                className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50 outline-none"
              >
                <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{t.id.slice(0, 8)}</td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">{t.name}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  <div>{s.ownerName}</div>
                  <div className="text-xs text-slate-400">{DEMO_OWNER_EMAIL}</div>
                </td>
                <td className="px-4 py-3 text-slate-500">{t.pageCount}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{s.copiesValue(t.printCopies)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {t.status === "draft" ? (
                    <span className="text-xs text-slate-500">{s.statusDraft}</span>
                  ) : isFullyIssued(t) ? (
                    <span className="text-xs text-slate-500 font-medium">{s.statusIssued}</span>
                  ) : (
                    <span className="text-xs text-[var(--color-status-green-fg)] font-medium">{s.statusPrintable}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1.5">
                    <Button disabled={t.status !== "printable"} onClick={() => setPrintTarget(t)}>
                      {isFullyIssued(t) ? s.reissue : s.print}
                    </Button>
                    <Button disabled={duplicatingId === t.id} onClick={() => duplicateTemplate(t)}>
                      {s.duplicate}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={deletingId === t.id || t.printedCount > 0}
                      title={t.printedCount > 0 ? s.deleteDisabledHasDocuments : undefined}
                      onClick={() => deleteTemplate(t)}
                    >
                      {s.delete}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <EmptyState>{s.emptyState}</EmptyState>}
      </Card>

      <p className="text-xs text-slate-400 mt-3">
        <Link href="/documents" className="hover:underline">
          {s.viewDocuments}
        </Link>
      </p>

      {printTarget && (
        <PrintSettingsDialog
          template={printTarget}
          onCancel={() => setPrintTarget(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}

function PrintSettingsDialog({
  template,
  onCancel,
  onRefresh,
}: {
  template: TemplateListItemDTO;
  onCancel: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 서버 재조회(onRefresh)와는 별개로, 발급이 실제로 성공한 순간 바로 이 값을 올려서
  // remaining을 0으로 만든다 — 그래야 "SOBP는 발급됐는데 파일만 실패"한 경우에도
  // 버튼이 남아있어 재클릭으로 중복 발급하는 사고를 막을 수 있다.
  const [issuedSoFar, setIssuedSoFar] = useState(0);
  const remaining = Math.max(0, template.printCopies - template.printedCount - issuedSoFar);

  function persist(next: PrintSettings) {
    setSettings(next);
    window.localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(next));
  }

  // 다운로드: 앱이 실제 프린터를 직접 구동하지 않으므로(파일 전달이 전부) "인쇄하기 N번
  // 클릭" 흉내 대신 설정 부수(printCopies) 전체를 한 번에 SOBP 발급하고 zip으로 내려준다
  // (2026-08-27). 원자적으로 전량 발급되므로 이후 remaining은 항상 0 — 발급 수 카운트를
  // 따로 추적할 필요가 없다.
  //
  // 버튼이 활성 상태로 보여도 실패할 수 있는 두 지점을 구분해서 처리한다:
  // (a) 발급 자체(POST documents) 실패 — 아무 것도 안 바뀌었으니 그대로 재시도 가능
  // (b) 발급은 성공했는데 파일만(GET pdf) 실패 — SOBP는 이미 만들어졌으므로 재시도(=재발급) 대신
  //     문서 조회의 "다시 받기"로 안내한다.
  async function handleDownload() {
    if (remaining <= 0) return;
    const toIssue = remaining;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: toIssue }),
      });
      if (!res.ok) {
        setError(s.issueFailed);
        return;
      }
      setIssuedSoFar((n) => n + toIssue);
      await onRefresh();

      const pdfRes = await fetch(`/api/templates/${template.id}/pdf?copies=${toIssue}`);
      if (!pdfRes.ok) {
        setError(s.fileFailed);
        return;
      }
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = toIssue === 1 ? `${template.name}.pdf` : `${template.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  // 다시 받기: 설정 부수가 이미 전량 발급된 상태(remaining === 0)에서는 새 SOBP를 더
  // 만들지 않고, 이미 발급된 것과 같은 원본 PDF를 그대로 다시 zip으로 받기만 한다
  // (2026-08-28) — 문서를 잘못 쓰거나 분실했을 때 FRM-01에서 바로 다시 받을 수 있도록,
  // DOC-02의 개별 "다시 받기"와 별개로 양식 단위 재발급 경로를 둔다.
  async function handleReissue() {
    setBusy(true);
    setError(null);
    try {
      const pdfRes = await fetch(`/api/templates/${template.id}/pdf?copies=${template.printCopies}`);
      if (!pdfRes.ok) {
        setError(s.reissueFailed);
        return;
      }
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = template.printCopies === 1 ? `${template.name}.pdf` : `${template.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 bg-[var(--color-brand-600)] text-white">
            <span>⬇</span>
            <h2 className="text-sm font-semibold">{s.printDialogTitle}</h2>
          </div>
          <div className="p-5 space-y-5">
            <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
              {s.printStatusInfo(template.printCopies)}
            </p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">{s.blueprintMode}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.blueprintModeDesc}</div>
              </div>
              <button
                onClick={() => persist({ ...settings, blueprintMode: !settings.blueprintMode })}
                className={`shrink-0 mt-0.5 relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${
                  settings.blueprintMode ? "bg-[var(--color-brand-600)]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                    settings.blueprintMode ? "translate-x-4.5" : ""
                  }`}
                />
              </button>
            </div>

            <div>
              <div className="text-sm font-medium text-[var(--foreground)]">{s.dotSize}</div>
              <div className="text-xs text-slate-400 mt-0.5 mb-2">{s.dotSizeDesc}</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  value={settings.dotSize}
                  onChange={(e) => persist({ ...settings, dotSize: Number(e.target.value) })}
                  className="flex-1 accent-[var(--color-brand-600)]"
                />
                <span className="text-sm font-medium tabular-nums w-8 text-right">{settings.dotSize.toFixed(1)}</span>
              </div>
            </div>

            <button
              onClick={() => persist(DEFAULT_PRINT_SETTINGS)}
              className="text-xs text-slate-500 underline cursor-pointer"
            >
              {s.resetDefault}
            </button>

            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              remaining <= 0 && <p className="text-xs text-slate-500">{s.reissueNote}</p>
            )}

            {remaining > 0 ? (
              <Button className="w-full" variant="primary" onClick={handleDownload} disabled={busy}>
                {busy ? s.printing : s.printAction}
              </Button>
            ) : (
              <Button className="w-full" variant="primary" onClick={handleReissue} disabled={busy}>
                {busy ? s.reissuing : s.reissueAction}
              </Button>
            )}
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <Button className="flex-1" onClick={onCancel} disabled={busy}>
              {s.cancel}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FilterTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm rounded-lg px-3 py-1.5 font-medium cursor-pointer ${
        active ? "bg-[var(--color-brand-600)] text-white" : "border border-[var(--color-border)] bg-white hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "green" }) {
  const toneClass = tone === "green" ? "text-[var(--color-status-green-fg)]" : "";
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </Card>
  );
}
