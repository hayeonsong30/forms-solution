"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TemplateListItemDTO } from "@/types";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

type Org = { id: string; name: string };
type FilterTab = "all" | "printable" | "not_printable";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateListItemDTO[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

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

  async function printDocument(templateId: string) {
    const res = await fetch(`/api/templates/${templateId}/documents`, { method: "POST" });
    if (res.ok) {
      const doc = await res.json();
      router.push(`/documents/${doc.id}`);
    }
  }

  async function togglePrintable(t: TemplateListItemDTO, printable: boolean) {
    const res = await fetch(`/api/templates/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printable }),
    });
    if (res.ok) await refresh();
  }

  const filtered = templates
    .filter((t) => (tab === "all" ? true : tab === "printable" ? t.printable : !t.printable))
    .filter(
      (t) =>
        query.trim() === "" ||
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.id.toLowerCase().includes(query.toLowerCase())
    );

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        title="양식 관리"
        actions={
          <Button variant="primary" onClick={createBlankTemplate} disabled={creating}>
            + 빈 양식 업로드
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm w-64">
          <span className="text-slate-400">⌕</span>
          <input
            className="flex-1 outline-none"
            placeholder="양식 ID·양식명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex gap-1">
          <FilterTabButton active={tab === "all"} onClick={() => setTab("all")}>
            전체
          </FilterTabButton>
          <FilterTabButton active={tab === "printable"} onClick={() => setTab("printable")}>
            Printable
          </FilterTabButton>
          <FilterTabButton active={tab === "not_printable"} onClick={() => setTab("not_printable")}>
            Not Printable
          </FilterTabButton>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium w-10">NO</th>
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Owner</th>
              <th className="px-4 py-2.5 font-medium">페이지</th>
              <th className="px-4 py-2.5 font-medium">필드</th>
              <th className="px-4 py-2.5 font-medium">프린트 상태</th>
              <th className="px-4 py-2.5 font-medium">등록일</th>
              <th className="px-4 py-2.5 font-medium">수정일</th>
              <th className="px-4 py-2.5 font-medium">작업</th>
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
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{t.id.slice(0, 8)}</td>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-slate-500">{t.org.name}</td>
                <td className="px-4 py-3 text-slate-500">{t.pageCount}</td>
                <td className="px-4 py-3 text-slate-500">{t.fieldCount}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    className="text-xs rounded-lg border border-[var(--color-border)] px-2 py-1 disabled:bg-slate-50 disabled:text-slate-400"
                    value={t.printable ? "printable" : "not_printable"}
                    disabled={t.status === "draft"}
                    onChange={(e) => togglePrintable(t, e.target.value === "printable")}
                  >
                    <option value="printable">Printable</option>
                    <option value="not_printable">Not Printable</option>
                  </select>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {t.printable ? "프린트 허용" : (t.printableReason ?? "편집 미완료")}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(t.createdAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <Button
                    disabled={!t.printable}
                    onClick={() => printDocument(t.id)}
                  >
                    프린트
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState>등록된 양식이 없습니다.</EmptyState>}
      </Card>

      <p className="text-xs text-slate-400 mt-3">
        <Link href="/documents" className="hover:underline">
          문서 조회 →
        </Link>
      </p>
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
