"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TemplateDTO } from "@/types";

type Org = { id: string; name: string };
type TemplateRow = TemplateDTO & { org: { name: string } };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const [t, o] = await Promise.all([
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/orgs").then((r) => r.json()),
    ]);
    setTemplates(t);
    setOrgs(o);
    if (!orgId && o[0]) setOrgId(o[0].id);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTemplate() {
    if (!name.trim() || !orgId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name, pageCount: 1 }),
      });
      if (!res.ok) throw new Error("create failed");
      setName("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold mb-6">양식 관리</h1>

      <div className="flex gap-2 mb-8">
        <select
          className="border rounded px-2 py-1"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="새 양식 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createTemplate()}
        />
        <button
          className="bg-blue-600 text-white rounded px-4 py-1 disabled:opacity-50"
          onClick={createTemplate}
          disabled={creating}
        >
          만들기
        </button>
      </div>

      <ul className="divide-y border rounded">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link href={`/editor/${t.id}`} className="font-medium hover:underline">
                {t.name}
              </Link>
              <div className="text-xs text-gray-500">
                {t.org.name} · {t.status} · {t.printable ? "인쇄 가능" : (t.printableReason ?? "편집 중")}
              </div>
            </div>
          </li>
        ))}
        {templates.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-500">아직 양식이 없습니다.</li>
        )}
      </ul>
    </main>
  );
}
