"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TemplateListItemDTO } from "@/types";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    pageTitle: "양식 관리",
    uploadBlank: "+ 빈 양식 업로드",
    blankTemplateName: "이름 없는 양식",
    confirmDelete: (name: string) => `"${name}" 양식을 삭제할까요? 되돌릴 수 없습니다.`,
    hasDocumentsError: (count: number) => `이미 발행된 문서가 ${count}건 있어 삭제할 수 없습니다.`,
    deleteFailed: "양식 삭제 실패",
    searchPlaceholder: "양식 ID·양식명 검색",
    tabAll: "전체",
    tabDraft: "편집 중",
    tabPrintable: "인쇄 가능",
    colNo: "NO",
    colId: "ID",
    colName: "Name",
    colOwner: "Owner",
    colPage: "페이지",
    colPrintStatus: "설정 / 남은 인쇄 (부)",
    colStatus: "상태",
    colCreatedAt: "등록일",
    colUpdatedAt: "수정일",
    colAction: "작업",
    statusDraft: "편집 중",
    statusPrintable: "인쇄 가능",
    print: "프린트",
    duplicate: "복제",
    delete: "삭제",
    emptyState: "등록된 양식이 없습니다.",
    viewDocuments: "문서 조회 →",
    printDialogTitle: "인쇄 설정",
    blueprintMode: "청사진 모드",
    blueprintModeDesc: "인쇄된 NCode 패턴과 구분하기 쉽게 문서 색상을 파란색으로 변환",
    dotSize: "NCode 점 크기",
    dotSizeDesc: "NCode 패턴 점 크기 조절 (0.1 ~ 2.0)",
    resetDefault: "기본값으로 재설정",
    printStatusInfo: (total: number, remaining: number) => `설정 ${total} / 남은 인쇄 ${remaining} (부)`,
    printCountCell: (total: number, remaining: number) => `${total} / ${remaining}`,
    cancel: "닫기",
    printing: "인쇄 등록 중…",
    printAction: "🖨 인쇄하기",
  },
  ja: {
    pageTitle: "フォーム管理",
    uploadBlank: "+ 空のフォームを作成",
    blankTemplateName: "名称未設定フォーム",
    confirmDelete: (name: string) => `「${name}」フォームを削除しますか？元に戻せません。`,
    hasDocumentsError: (count: number) => `すでに発行済みの文書が${count}件あるため削除できません。`,
    deleteFailed: "フォームの削除に失敗しました",
    searchPlaceholder: "フォームID・フォーム名で検索",
    tabAll: "すべて",
    tabDraft: "編集中",
    tabPrintable: "印刷可能",
    colNo: "NO",
    colId: "ID",
    colName: "Name",
    colOwner: "Owner",
    colPage: "ページ",
    colPrintStatus: "設定 / 残り印刷（部）",
    colStatus: "ステータス",
    colCreatedAt: "登録日",
    colUpdatedAt: "更新日",
    colAction: "操作",
    statusDraft: "編集中",
    statusPrintable: "印刷可能",
    print: "印刷",
    duplicate: "複製",
    delete: "削除",
    emptyState: "登録されたフォームがありません。",
    viewDocuments: "文書一覧 →",
    printDialogTitle: "印刷設定",
    blueprintMode: "ブループリントモード",
    blueprintModeDesc: "印刷されたNCodeパターンと区別しやすいよう文書の色を青色に変換します",
    dotSize: "NCodeドットサイズ",
    dotSizeDesc: "NCodeパターンのドットサイズを調整（0.1〜2.0）",
    resetDefault: "デフォルトに戻す",
    printStatusInfo: (total: number, remaining: number) => `設定 ${total} / 残り印刷 ${remaining}（部）`,
    printCountCell: (total: number, remaining: number) => `${total} / ${remaining}`,
    cancel: "閉じる",
    printing: "印刷登録中…",
    printAction: "🖨 印刷する",
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
type FilterTab = "all" | "draft" | "printable";

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
    .filter((t) => tab === "all" || t.status === tab)
    .filter(
      (t) =>
        query.trim() === "" ||
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.id.toLowerCase().includes(query.toLowerCase())
    );

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
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.colPrintStatus}</th>
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
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{t.org.name}</td>
                <td className="px-4 py-3 text-slate-500">{t.pageCount}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {s.printCountCell(t.printCopies, Math.max(0, t.printCopies - t.printedCount))}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {t.status === "draft" ? (
                    <span className="text-xs text-slate-500">{s.statusDraft}</span>
                  ) : (
                    <span className="text-xs text-[var(--color-status-green-fg)] font-medium">{s.statusPrintable}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1.5">
                    <Button disabled={t.status !== "printable"} onClick={() => setPrintTarget(t)}>
                      {s.print}
                    </Button>
                    <Button disabled={duplicatingId === t.id} onClick={() => duplicateTemplate(t)}>
                      {s.duplicate}
                    </Button>
                    <Button variant="danger" disabled={deletingId === t.id} onClick={() => deleteTemplate(t)}>
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
          onPrinted={async () => {
            await refresh();
            setPrintTarget(null);
          }}
        />
      )}
    </div>
  );
}

function PrintSettingsDialog({
  template,
  onCancel,
  onPrinted,
}: {
  template: TemplateListItemDTO;
  onCancel: () => void;
  onPrinted: () => Promise<void>;
}) {
  const { lang } = useLanguage();
  const s = STRINGS[lang];
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  const [busy, setBusy] = useState(false);
  const remaining = Math.max(0, template.printCopies - template.printedCount);

  function persist(next: PrintSettings) {
    setSettings(next);
    window.localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(next));
  }

  // 인쇄하기: 클릭할 때마다 새 SOBP 1부(=이 양식의 페이지 수만큼)를 순차 발급해 문서함에
  // 1건 등록한다(2026-08-27 정책 — "다운로드" 버튼은 없앰: 원래 인쇄 스펙은 프린터 솔루션
  // 앱 호출·위임이고, 지금 이 요청이 실제로 어떻게 처리되는지(파일 전달 vs 프린터 호출)는
  // 사용자에게 노출되지 않는 내부 구현일 뿐이다). 설정 부수(printCopies)에 도달하면
  // remaining이 0이 되어 버튼이 비활성화된다.
  async function handlePrint() {
    if (remaining <= 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
      if (res.ok) await onPrinted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 bg-[var(--color-brand-600)] text-white">
            <span>🖶</span>
            <h2 className="text-sm font-semibold">{s.printDialogTitle}</h2>
          </div>
          <div className="p-5 space-y-5">
            <p className="text-xs text-slate-500 bg-slate-50 rounded-md px-3 py-2">
              {s.printStatusInfo(template.printCopies, remaining)}
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

            <Button className="w-full" variant="primary" onClick={handlePrint} disabled={busy || remaining <= 0}>
              {busy ? s.printing : s.printAction}
            </Button>
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
