"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

type Org = { id: string; name: string };

type UsageStats = {
  ocrDocuments: number;
  pagesUsed: number;
  fieldsRecognized: number;
  successRate: number;
  avgSeconds: number | null;
  retried: number;
  failedCount: number;
  quota: number;
  quotaPct?: number;
};

type OrgScope = {
  orgId: string;
  orgName: string;
  userTotal: number;
  userActive: number;
  templateTotal: number;
  templatePrintable: number;
  documentTotal: number;
  documentConfirmed: number;
  documentWriting: number;
  documentNeedsReviewFields: number;
  usage: UsageStats;
  topTemplates: { name: string; count: number }[];
  topUsers: { name: string; count: number }[];
};

type SystemScope = {
  orgCount: number;
  userTotal: number;
  userActive: number;
  newOrgs30d: number;
  churnedOrgs30d: number;
  usage: UsageStats;
  monthlyBars: { label: string; count: number; pct: number }[];
  needsReviewFieldCount: number;
  perOrg: OrgScope[];
  topOcrTenants: OrgScope[];
  topDocumentTenants: OrgScope[];
};

const STATUS: Record<DocumentStatus, { label: string; tone: "amber" | "green" | "slate" | "red" | "brand" }> = {
  printed: { label: "인쇄됨", tone: "slate" },
  received: { label: "작성", tone: "slate" },
  processing: { label: "처리 중", tone: "brand" },
  review_required: { label: "확인 필요", tone: "amber" },
  confirmed: { label: "완료", tone: "green" },
  error: { label: "오류", tone: "red" },
};

type ViewScope = "org" | "system";

// 프로토타입 index.html dashboard-page 구조를 그대로 따른다: KPI(사용자/양식/문서/처리필요)
// → 최근 문서 + 빠른 실행 → AI OCR 사용량 → TOP 사용자·TOP 양식 랭킹 (고객사 뷰),
// 시스템 관리자 뷰는 별도 5-KPI(고객사/사용자/활성/신규/해지) → 플랫폼 AI 사용량 + 운영 확인
// → 고객사별 사용 현황 표 → TOP OCR 고객사·TOP 문서처리 고객사 랭킹.
export default function DashboardPage() {
  const router = useRouter();
  const [scope, setScope] = useState<ViewScope>("org");
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null);
  const [systemScope, setSystemScope] = useState<SystemScope | null>(null);
  const [documents, setDocuments] = useState<DocumentListItemDTO[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/documents").then((r) => r.json()),
      fetch("/api/orgs").then((r) => r.json()),
    ]).then(([dash, d, o]) => {
      setOrgScope(dash.org);
      setSystemScope(dash.system);
      setDocuments(d);
      setOrgs(o);
    });
  }, []);

  const recentDocuments = useMemo(() => documents.slice(0, 8), [documents]);

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

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
      <PageHeader
        title="대시보드"
        actions={
          <div className="flex rounded-lg border border-[var(--color-border)] bg-white p-0.5 text-sm">
            {(["org", "system"] as ViewScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-md px-3 py-1.5 font-medium cursor-pointer transition-colors ${
                  scope === s ? "bg-[var(--color-brand-600)] text-white" : "text-slate-500 hover:text-[var(--foreground)]"
                }`}
              >
                {s === "org" ? "고객사" : "시스템 관리자"}
              </button>
            ))}
          </div>
        }
      />
      <p className="text-sm text-slate-400 -mt-4 mb-6">
        {scope === "org" ? "우리 회사의 양식·문서·AI OCR 사용 현황을 확인합니다." : "전체 고객사·사용자·AI OCR 운영 현황을 확인합니다."}
      </p>

      {scope === "org" ? (
        <OrgDashboard
          scope={orgScope}
          recentDocuments={recentDocuments}
          creating={creating}
          onCreateBlank={createBlankTemplate}
          onOpenDocument={(id) => router.push(`/documents/${id}`)}
        />
      ) : (
        <SystemDashboard scope={systemScope} />
      )}
    </div>
  );
}

function OrgDashboard({
  scope,
  recentDocuments,
  creating,
  onCreateBlank,
  onOpenDocument,
}: {
  scope: OrgScope | null;
  recentDocuments: DocumentListItemDTO[];
  creating: boolean;
  onCreateBlank: () => void;
  onOpenDocument: (id: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SplitKpiCard tone="navy" icon="♙" caption="현재 기준" title="사용자" primary={scope?.userTotal ?? 0} primaryLabel="전체 등록" secondary={scope?.userActive ?? 0} secondaryLabel="활성" />
        <SplitKpiCard
          tone="blue"
          icon="▤"
          caption="현재 기준"
          title="양식"
          primary={scope?.templateTotal ?? 0}
          primaryLabel="전체"
          secondary={scope?.templatePrintable ?? 0}
          secondaryLabel="인쇄 가능"
        />
        <SplitKpiCard
          tone="green"
          icon="▧"
          caption="최근 30일"
          title="문서"
          primary={scope?.documentTotal ?? 0}
          primaryLabel="전체"
          secondary={scope?.documentConfirmed ?? 0}
          secondaryLabel="완료"
        />
        <SplitKpiCard
          tone="amber"
          icon="!"
          caption="지금 확인"
          title="처리 필요"
          primary={scope?.documentWriting ?? 0}
          primaryLabel="작성"
          secondary={scope?.documentNeedsReviewFields ?? 0}
          secondaryLabel="확인 필요 필드"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="text-sm font-medium text-[var(--foreground)]">최근 문서</div>
            <Link href="/documents" className="text-xs text-[var(--color-brand-600)] hover:underline">
              전체 문서 보기 →
            </Link>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">문서 번호</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">양식</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">소유자</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">상태</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">최근 일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {recentDocuments.slice(0, 5).map((d) => {
                const status = STATUS[d.status];
                return (
                  <tr key={d.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpenDocument(d.id)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{d.ncode ?? d.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{d.templateVersion.template.name}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{d.org?.name ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(d.createdAt).toLocaleString("ko-KR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {recentDocuments.length === 0 && <EmptyState>등록된 문서가 없습니다.</EmptyState>}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium text-[var(--foreground)] mb-3">빠른 실행</div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={onCreateBlank} disabled={creating}>
              + 새 양식 만들기
            </Button>
            <Link href="/documents">
              <Button className="w-full">펜 데이터 가져오기</Button>
            </Link>
            <Link href="/templates">
              <Button className="w-full">양식 관리 열기</Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-slate-400">AI OCR USAGE</div>
            <div className="text-sm font-medium text-[var(--foreground)]">우리 회사 AI OCR 사용량</div>
          </div>
          <span className="text-xs text-slate-400">이번 달</span>
        </div>
        <UsageMeter usage={scope?.usage} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RankingCard eyebrow="TOP USERS" title="문서 사용량 상위 사용자" period="누적" items={(scope?.topUsers ?? []).map((u) => ({ label: u.name, count: `${u.count}건` }))} />
        <RankingCard eyebrow="TOP FORMS" title="많이 사용한 양식" period="누적" items={(scope?.topTemplates ?? []).map((t) => ({ label: t.name, count: `${t.count}건` }))} />
      </div>
    </>
  );
}

function SystemDashboard({ scope }: { scope: SystemScope | null }) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <SimpleKpiCard tone="blue" icon="▦" caption="TENANT" value={scope?.orgCount ?? 0} title="이용 고객사" desc="현재 서비스 사용 상태인 고객사" />
        <SimpleKpiCard tone="navy" icon="♙" caption="USER" value={scope?.userTotal ?? 0} title="전체 등록 사용자" desc="전체 고객사에 등록된 계정" />
        <SimpleKpiCard tone="green" icon="●" caption="ACTIVE" value={scope?.userActive ?? 0} title="활성 사용자" desc="최근 문서를 처리한 계정" />
        <SimpleKpiCard tone="green" icon="＋" caption="NEW" value={scope?.newOrgs30d ?? 0} title="최근 등록 고객사" desc="최근 30일 이내 새로 등록" />
        <SimpleKpiCard tone="amber" icon="−" caption="CHURN" value={scope?.churnedOrgs30d ?? 0} title="최근 해지 고객사" desc="사용 종료 추적 예정" />
      </div>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-slate-400">PLATFORM AI USAGE</div>
            <div className="text-sm font-medium text-[var(--foreground)]">전체 AI OCR 사용량</div>
          </div>
          <span className="text-xs text-slate-400">이번 달</span>
        </div>
        <UsageMeter usage={scope?.usage} />
        <div className="mt-4">
          <div className="text-xs text-slate-400 mb-2">최근 6개월 AI 요청 건수</div>
          <div className="flex items-end gap-2 h-20">
            {(scope?.monthlyBars ?? []).map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t bg-[var(--color-brand-500)]" style={{ height: `${Math.max(b.pct, 2)}%` }} title={`${b.count}건`} />
                <span className="text-[10px] text-slate-400">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden mb-6">
        <div className="px-5 pt-4 pb-2">
          <div className="text-xs text-slate-400">TENANT USAGE</div>
          <div className="text-sm font-medium text-[var(--foreground)]">고객사별 사용자·AI OCR 현황</div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">고객사</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">등록 사용자</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">활성 사용자</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">OCR 문서</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">OCR 페이지</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">성공률</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">월 한도</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {scope?.perOrg.map((o) => (
              <tr key={o.orgId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{o.orgName}</td>
                <td className="px-4 py-3 text-slate-500">{o.userTotal}</td>
                <td className="px-4 py-3 text-slate-500">{o.userActive}</td>
                <td className="px-4 py-3 text-slate-500">{o.usage.ocrDocuments}</td>
                <td className="px-4 py-3 text-slate-500">{o.usage.pagesUsed}</td>
                <td className="px-4 py-3 text-slate-500">{o.usage.successRate.toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <Badge tone={(o.usage.quotaPct ?? 0) >= 80 ? "amber" : "slate"}>{Math.round(o.usage.quotaPct ?? 0)}%</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {(!scope || scope.perOrg.length === 0) && <EmptyState>등록된 고객사가 없습니다.</EmptyState>}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RankingCard
          eyebrow="TOP OCR TENANTS"
          title="AI OCR 사용량 상위 고객사"
          period="이번 달"
          items={(scope?.topOcrTenants ?? []).map((o) => ({ label: o.orgName, count: `${o.usage.pagesUsed}페이지` }))}
        />
        <RankingCard
          eyebrow="TOP DOCUMENT TENANTS"
          title="문서 처리량 상위 고객사"
          period="누적"
          items={(scope?.topDocumentTenants ?? []).map((o) => ({ label: o.orgName, count: `${o.documentTotal}건` }))}
        />
      </div>
    </>
  );
}

const KPI_TONE_CLASS: Record<string, string> = {
  navy: "bg-slate-800 text-white",
  blue: "bg-[var(--color-brand-600)] text-white",
  green: "bg-[var(--color-status-green-fg)] text-white",
  amber: "bg-[var(--color-status-amber-fg)] text-white",
};

function SplitKpiCard({
  tone,
  icon,
  caption,
  title,
  primary,
  primaryLabel,
  secondary,
  secondaryLabel,
}: {
  tone: keyof typeof KPI_TONE_CLASS;
  icon: string;
  caption: string;
  title: string;
  primary: number;
  primaryLabel: string;
  secondary: number;
  secondaryLabel: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`w-6 h-6 rounded flex items-center justify-center text-xs ${KPI_TONE_CLASS[tone]}`}>{icon}</span>
        <span className="text-[10px] text-slate-400">{caption}</span>
      </div>
      <div className="text-xs text-slate-400 mb-1">{title}</div>
      <div className="flex items-baseline gap-4">
        <div>
          <span className="text-xl font-semibold text-[var(--foreground)]">{primary}</span>
          <div className="text-[10px] text-slate-400">{primaryLabel}</div>
        </div>
        <div>
          <span className="text-xl font-semibold text-[var(--foreground)]">{secondary}</span>
          <div className="text-[10px] text-slate-400">{secondaryLabel}</div>
        </div>
      </div>
    </Card>
  );
}

function SimpleKpiCard({
  tone,
  icon,
  caption,
  value,
  title,
  desc,
}: {
  tone: keyof typeof KPI_TONE_CLASS;
  icon: string;
  caption: string;
  value: number;
  title: string;
  desc: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`w-6 h-6 rounded flex items-center justify-center text-xs ${KPI_TONE_CLASS[tone]}`}>{icon}</span>
        <span className="text-[10px] text-slate-400">{caption}</span>
      </div>
      <div className="text-xl font-semibold text-[var(--foreground)]">{value}</div>
      <div className="text-xs font-medium mt-0.5">{title}</div>
      <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
    </Card>
  );
}

function UsageMeter({ usage }: { usage?: UsageStats }) {
  const pagesUsed = usage?.pagesUsed ?? 0;
  const quota = usage?.quota ?? 1;
  const pct = Math.min(100, (pagesUsed / quota) * 100);
  return (
    <>
      <div className="flex items-baseline gap-2 mb-1">
        <strong className="text-2xl font-semibold text-[var(--foreground)]">{pagesUsed.toLocaleString()}</strong>
        <span className="text-sm text-slate-400">/ {quota.toLocaleString()} 페이지</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
        <div
          className={`h-full rounded-full ${pct >= 80 ? "bg-[var(--color-status-amber-fg)]" : "bg-[var(--color-brand-500)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mb-3">월 사용량의 {pct.toFixed(1)}%를 사용했습니다.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <UsageStat label="OCR 문서" value={`${usage?.ocrDocuments ?? 0}건`} />
        <UsageStat label="인식 필드" value={`${usage?.fieldsRecognized ?? 0}개`} />
        <UsageStat label="성공률" value={`${(usage?.successRate ?? 100).toFixed(1)}%`} />
        <UsageStat label="평균 처리" value={usage?.avgSeconds != null ? `${usage.avgSeconds.toFixed(1)}초` : "-"} />
        <UsageStat label="재처리" value={`${usage?.retried ?? 0}건`} />
      </div>
    </>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function RankingCard({ eyebrow, title, period, items }: { eyebrow: string; title: string; period: string; items: { label: string; count: string }[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-slate-400">{eyebrow}</div>
          <div className="text-sm font-medium text-[var(--foreground)]">{title}</div>
        </div>
        <span className="text-xs text-slate-400">{period}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">데이터가 없습니다.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={item.label} className="flex items-center gap-3 text-sm">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="flex-1 truncate">{item.label}</span>
              <span className="text-slate-400 text-xs">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

