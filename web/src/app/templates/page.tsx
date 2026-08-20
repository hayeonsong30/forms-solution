"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TemplateListItemDTO } from "@/types";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

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
  const [templates, setTemplates] = useState<TemplateListItemDTO[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
        body: JSON.stringify({ orgId: orgs[0].id, name: "이름 없는 양식", pageCount: 1 }),
      });
      if (!res.ok) throw new Error("create failed");
      const created = await res.json();
      router.push(`/editor/${created.id}`);
    } finally {
      setCreating(false);
    }
  }

  // 프린트는 (1) NCode 인쇄 파일을 PDF로 내려받고 (2) 문서 조회에 잡힐 문서 레코드를
  // 함께 생성한다 — 실물 인쇄와 시스템 등록이 항상 같이 일어나야 하기 때문. 실제 NCode
  // 패턴 인코딩은 wasm-pdf-core 연동 전까지 아직 없어(project memory 참고) 지금은 원본
  // 양식 PDF를 그대로 내려받는다 — 다운로드되는 실제 인쇄 파일은 이 단계에서 아직 손대지
  // 않는다는 걸 다이얼로그에 명시한다.
  async function confirmPrint(template: TemplateListItemDTO) {
    const pdfRes = await fetch(`/api/templates/${template.id}/pdf`);
    if (pdfRes.ok) {
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
    const res = await fetch(`/api/templates/${template.id}/documents`, { method: "POST" });
    setPrintTarget(null);
    if (res.ok) {
      const doc = await res.json();
      router.push(`/documents/${doc.id}`);
    }
  }

  // 이미 발행된 문서가 있으면 서버가 409로 막는다 — 그 경우 사유를 그대로 보여준다.
  async function deleteTemplate(t: TemplateListItemDTO) {
    if (!window.confirm(`"${t.name}" 양식을 삭제할까요? 되돌릴 수 없습니다.`)) return;
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
          ? `이미 발행된 문서가 ${json.documentCount}건 있어 삭제할 수 없습니다.`
          : "양식 삭제 실패"
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
        title="양식 관리"
        actions={
          <Button variant="primary" onClick={createBlankTemplate} disabled={creating}>
            + 빈 양식 업로드
          </Button>
        }
      />

      {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm w-full sm:w-64">
          <span className="text-slate-400">⌕</span>
          <input
            className="flex-1 outline-none min-w-0"
            placeholder="양식 ID·양식명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex gap-1 flex-wrap">
          <FilterTabButton active={tab === "all"} onClick={() => setTab("all")}>
            전체
          </FilterTabButton>
          <FilterTabButton active={tab === "draft"} onClick={() => setTab("draft")}>
            편집 중
          </FilterTabButton>
          <FilterTabButton active={tab === "printable"} onClick={() => setTab("printable")}>
            인쇄 가능
          </FilterTabButton>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium w-10 whitespace-nowrap">NO</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">ID</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Name</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Owner</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">페이지</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">필드</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">상태</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">등록일</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">수정일</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">작업</th>
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
                <td className="px-4 py-3 text-slate-500">{t.fieldCount}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {t.status === "draft" ? (
                    <span className="text-xs text-slate-500">편집 중</span>
                  ) : (
                    <span className="text-xs text-[var(--color-status-green-fg)] font-medium">인쇄 가능</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1.5">
                    <Button disabled={t.status !== "printable"} onClick={() => setPrintTarget(t)}>
                      프린트
                    </Button>
                    <Button variant="danger" disabled={deletingId === t.id} onClick={() => deleteTemplate(t)}>
                      삭제
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <EmptyState>등록된 양식이 없습니다.</EmptyState>}
      </Card>

      <p className="text-xs text-slate-400 mt-3">
        <Link href="/documents" className="hover:underline">
          문서 조회 →
        </Link>
      </p>

      {printTarget && (
        <PrintSettingsDialog template={printTarget} onCancel={() => setPrintTarget(null)} onConfirm={confirmPrint} />
      )}
    </div>
  );
}

function PrintSettingsDialog({
  template,
  onCancel,
  onConfirm,
}: {
  template: TemplateListItemDTO;
  onCancel: () => void;
  onConfirm: (template: TemplateListItemDTO) => Promise<void>;
}) {
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  const [busy, setBusy] = useState(false);

  function persist(next: PrintSettings) {
    setSettings(next);
    window.localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(next));
  }

  async function handleDownload() {
    setBusy(true);
    try {
      await onConfirm(template);
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
            <h2 className="text-sm font-semibold">인쇄 설정</h2>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">청사진 모드</div>
                <div className="text-xs text-slate-400 mt-0.5">인쇄된 NCode 패턴과 구분하기 쉽게 문서 색상을 파란색으로 변환</div>
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
              <div className="text-sm font-medium text-[var(--foreground)]">NCode 점 크기</div>
              <div className="text-xs text-slate-400 mt-0.5 mb-2">NCode 패턴 점 크기 조절 (0.1 ~ 2.0)</div>
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
              기본값으로 재설정
            </button>

            <p className="text-xs text-[var(--color-brand-700)] bg-[var(--color-brand-50)] rounded-lg px-3 py-2.5">
              ⓘ 이 설정은 향후 인쇄 시 기본값으로 저장됩니다. 다운로드되는 PDF에는 실제 NCode 패턴이 아직 적용되지 않습니다 —
              스마트펜 SDK 연동 전까지는 원본 양식 PDF가 그대로 내려받아집니다.
            </p>
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <Button className="flex-1" onClick={onCancel} disabled={busy}>
              취소
            </Button>
            <Button className="flex-1" variant="primary" onClick={handleDownload} disabled={busy}>
              {busy ? "다운로드 중…" : "↓ 다운로드"}
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
