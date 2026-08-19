"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TemplateDTO } from "@/types";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";

type Org = { id: string; name: string };
type TemplateRow = TemplateDTO & { org: { name: string } };

export default function TemplatesPage() {
  const router = useRouter();
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

  async function printDocument(templateId: string) {
    const res = await fetch(`/api/templates/${templateId}/documents`, { method: "POST" });
    if (res.ok) {
      const doc = await res.json();
      router.push(`/documents/${doc.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <PageHeader title="양식 관리" />

      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <Select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="shrink-0">
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Input
            className="flex-1"
            placeholder="새 양식 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTemplate()}
          />
          <Button variant="primary" onClick={createTemplate} disabled={creating}>
            만들기
          </Button>
        </div>
      </Card>

      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <Link href={`/editor/${t.id}`} className="font-medium text-sm hover:text-[var(--color-brand-600)]">
                  {t.name}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">{t.org.name}</span>
                  <StatusBadge template={t} />
                </div>
              </div>
              {t.printable && (
                <Button onClick={() => printDocument(t.id)}>문서 만들기 (인쇄)</Button>
              )}
            </li>
          ))}
          {templates.length === 0 && (
            <li>
              <EmptyState>아직 양식이 없습니다.</EmptyState>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function StatusBadge({ template }: { template: TemplateRow }) {
  if (template.printable) return <Badge tone="green">인쇄 가능</Badge>;
  if (template.printableReason) return <Badge tone="amber">{template.printableReason}</Badge>;
  return <Badge tone="slate">편집 중</Badge>;
}
