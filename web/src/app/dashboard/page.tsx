"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentListItemDTO, DocumentStatus } from "@/types";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { useLanguage, type Lang } from "@/lib/language";

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

const STATUS_TONE: Record<DocumentStatus, "amber" | "green" | "slate" | "red" | "brand"> = {
  printed: "slate",
  received: "slate",
  processing: "brand",
  review_required: "amber",
  confirmed: "green",
  error: "red",
};

type ViewScope = "org" | "system";

const STRINGS = {
  ko: {
    pageTitle: "대시보드",
    scopeToggle: { org: "고객사", system: "시스템 관리자" },
    subtitle: {
      org: "우리 회사의 양식·문서·AI OCR 사용 현황을 확인합니다.",
      system: "전체 고객사·사용자·AI OCR 운영 현황을 확인합니다.",
    },
    status: {
      printed: "인쇄됨",
      received: "작성",
      processing: "처리 중",
      review_required: "확인 필요",
      confirmed: "완료",
      error: "오류",
    } satisfies Record<DocumentStatus, string>,
    newTemplateName: "이름 없는 양식",
    org: {
      kpi: {
        users: { caption: "현재 기준", title: "사용자", primaryLabel: "전체 등록", secondaryLabel: "활성" },
        forms: { caption: "현재 기준", title: "양식", primaryLabel: "전체", secondaryLabel: "인쇄 가능" },
        documents: { caption: "최근 30일", title: "문서", primaryLabel: "전체", secondaryLabel: "완료" },
        needsAction: { caption: "지금 확인", title: "처리 필요", primaryLabel: "작성", secondaryLabel: "확인 필요 필드" },
      },
      recentDocuments: {
        title: "최근 문서",
        viewAll: "전체 문서 보기 →",
        table: { docNo: "문서 번호", form: "양식", owner: "소유자", status: "상태", lastUpdated: "최근 일시" },
        empty: "등록된 문서가 없습니다.",
      },
      quickActions: {
        title: "빠른 실행",
        createBlank: "+ 새 양식 만들기",
        importPen: "펜 데이터 가져오기",
        openTemplates: "양식 관리 열기",
      },
      usageCard: { title: "우리 회사 AI OCR 사용량", thisMonth: "이번 달" },
      ranking: {
        topUsers: { title: "문서 사용량 상위 사용자", period: "누적" },
        topForms: { title: "많이 사용한 양식", period: "누적" },
      },
    },
    system: {
      kpi: {
        tenants: { title: "이용 고객사", desc: "현재 서비스 사용 상태인 고객사" },
        users: { title: "전체 등록 사용자", desc: "전체 고객사에 등록된 계정" },
        active: { title: "활성 사용자", desc: "최근 문서를 처리한 계정" },
        newOrgs: { title: "최근 등록 고객사", desc: "최근 30일 이내 새로 등록" },
        churnedOrgs: { title: "최근 해지 고객사", desc: "사용 종료 추적 예정" },
      },
      usageCard: { title: "전체 AI OCR 사용량", thisMonth: "이번 달", monthlyRequests: "최근 6개월 AI 요청 건수" },
      tenantTable: {
        title: "고객사별 사용자·AI OCR 현황",
        headers: {
          tenant: "고객사",
          registeredUsers: "등록 사용자",
          activeUsers: "활성 사용자",
          ocrDocs: "OCR 문서",
          ocrPages: "OCR 페이지",
          successRate: "성공률",
          monthlyQuota: "월 한도",
        },
        empty: "등록된 고객사가 없습니다.",
      },
      ranking: {
        topOcr: { title: "AI OCR 사용량 상위 고객사", period: "이번 달" },
        topDocuments: { title: "문서 처리량 상위 고객사", period: "누적" },
      },
    },
    usageMeter: {
      quota: (n: number) => `/ ${n.toLocaleString()} 페이지`,
      usedPct: (pct: number) => `월 사용량의 ${pct.toFixed(1)}%를 사용했습니다.`,
      stats: {
        ocrDocs: "OCR 문서",
        fieldsRecognized: "인식 필드",
        successRate: "성공률",
        avgProcessing: "평균 처리",
        retried: "재처리",
      },
    },
    count: {
      geon: (n: number) => `${n}건`,
      gae: (n: number) => `${n}개`,
      page: (n: number) => `${n}페이지`,
      pct: (n: number) => `${n.toFixed(1)}%`,
      sec: (n: number | null) => (n != null ? `${n.toFixed(1)}초` : "-"),
    },
    rankingEmpty: "데이터가 없습니다.",
  },
  ja: {
    pageTitle: "ダッシュボード",
    scopeToggle: { org: "顧客企業", system: "システム管理者" },
    subtitle: {
      org: "自社の様式・文書・AI OCR使用状況を確認します。",
      system: "全顧客企業・ユーザー・AI OCR運用状況を確認します。",
    },
    status: {
      printed: "印刷済み",
      received: "作成中",
      processing: "処理中",
      review_required: "確認要",
      confirmed: "完了",
      error: "エラー",
    } satisfies Record<DocumentStatus, string>,
    newTemplateName: "名称未設定の様式",
    org: {
      kpi: {
        users: { caption: "現在時点", title: "ユーザー", primaryLabel: "全体登録", secondaryLabel: "アクティブ" },
        forms: { caption: "現在時点", title: "様式", primaryLabel: "全体", secondaryLabel: "印刷可能" },
        documents: { caption: "直近30日", title: "文書", primaryLabel: "全体", secondaryLabel: "完了" },
        needsAction: { caption: "今すぐ確認", title: "処理が必要", primaryLabel: "作成中", secondaryLabel: "確認が必要な項目" },
      },
      recentDocuments: {
        title: "最近の文書",
        viewAll: "すべての文書を見る →",
        table: { docNo: "文書番号", form: "様式", owner: "所有者", status: "状態", lastUpdated: "最終更新日時" },
        empty: "登録された文書がありません。",
      },
      quickActions: {
        title: "クイック実行",
        createBlank: "+ 新しい様式を作成",
        importPen: "ペンデータの取り込み",
        openTemplates: "様式管理を開く",
      },
      usageCard: { title: "自社のAI OCR使用量", thisMonth: "今月" },
      ranking: {
        topUsers: { title: "文書使用量上位ユーザー", period: "累計" },
        topForms: { title: "よく使われる様式", period: "累計" },
      },
    },
    system: {
      kpi: {
        tenants: { title: "利用顧客企業", desc: "現在サービスを利用中の顧客企業" },
        users: { title: "全体登録ユーザー", desc: "全顧客企業に登録されたアカウント" },
        active: { title: "アクティブユーザー", desc: "最近文書を処理したアカウント" },
        newOrgs: { title: "最近登録した顧客企業", desc: "直近30日以内に新規登録" },
        churnedOrgs: { title: "最近解約した顧客企業", desc: "利用終了の追跡予定" },
      },
      usageCard: { title: "全体AI OCR使用量", thisMonth: "今月", monthlyRequests: "直近6か月のAIリクエスト件数" },
      tenantTable: {
        title: "顧客企業別ユーザー・AI OCR状況",
        headers: {
          tenant: "顧客企業",
          registeredUsers: "登録ユーザー",
          activeUsers: "アクティブユーザー",
          ocrDocs: "OCR文書",
          ocrPages: "OCRページ",
          successRate: "成功率",
          monthlyQuota: "月間上限",
        },
        empty: "登録された顧客企業がありません。",
      },
      ranking: {
        topOcr: { title: "AI OCR使用量上位の顧客企業", period: "今月" },
        topDocuments: { title: "文書処理量上位の顧客企業", period: "累計" },
      },
    },
    usageMeter: {
      quota: (n: number) => `/ ${n.toLocaleString()} ページ`,
      usedPct: (pct: number) => `月間使用量の${pct.toFixed(1)}%を使用しました。`,
      stats: {
        ocrDocs: "OCR文書",
        fieldsRecognized: "認識項目",
        successRate: "成功率",
        avgProcessing: "平均処理",
        retried: "再処理",
      },
    },
    count: {
      geon: (n: number) => `${n}件`,
      gae: (n: number) => `${n}個`,
      page: (n: number) => `${n}ページ`,
      pct: (n: number) => `${n.toFixed(1)}%`,
      sec: (n: number | null) => (n != null ? `${n.toFixed(1)}秒` : "-"),
    },
    rankingEmpty: "データがありません。",
  },
} satisfies Record<Lang, unknown>;

type Strings = (typeof STRINGS)["ko"];

// 프로토타입 index.html dashboard-page 구조를 그대로 따른다: KPI(사용자/양식/문서/처리필요)
// → 최근 문서 + 빠른 실행 → AI OCR 사용량 → TOP 사용자·TOP 양식 랭킹 (고객사 뷰),
// 시스템 관리자 뷰는 별도 5-KPI(고객사/사용자/활성/신규/해지) → 플랫폼 AI 사용량 + 운영 확인
// → 고객사별 사용 현황 표 → TOP OCR 고객사·TOP 문서처리 고객사 랭킹.
export default function DashboardPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const s = STRINGS[lang];
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
        body: JSON.stringify({ orgId: orgs[0].id, name: s.newTemplateName, pageCount: 1 }),
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
        title={s.pageTitle}
        actions={
          <div className="flex rounded-lg border border-[var(--color-border)] bg-white p-0.5 text-sm">
            {(["org", "system"] as ViewScope[]).map((v) => (
              <button
                key={v}
                onClick={() => setScope(v)}
                className={`rounded-md px-3 py-1.5 font-medium cursor-pointer transition-colors ${
                  scope === v ? "bg-[var(--color-brand-600)] text-white" : "text-slate-500 hover:text-[var(--foreground)]"
                }`}
              >
                {s.scopeToggle[v]}
              </button>
            ))}
          </div>
        }
      />
      <p className="text-sm text-slate-400 -mt-4 mb-6">{scope === "org" ? s.subtitle.org : s.subtitle.system}</p>

      {scope === "org" ? (
        <OrgDashboard
          scope={orgScope}
          recentDocuments={recentDocuments}
          creating={creating}
          onCreateBlank={createBlankTemplate}
          onOpenDocument={(id) => router.push(`/documents/${id}`)}
          s={s}
        />
      ) : (
        <SystemDashboard scope={systemScope} s={s} />
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
  s,
}: {
  scope: OrgScope | null;
  recentDocuments: DocumentListItemDTO[];
  creating: boolean;
  onCreateBlank: () => void;
  onOpenDocument: (id: string) => void;
  s: Strings;
}) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SplitKpiCard
          tone="navy"
          icon="♙"
          caption={s.org.kpi.users.caption}
          title={s.org.kpi.users.title}
          primary={scope?.userTotal ?? 0}
          primaryLabel={s.org.kpi.users.primaryLabel}
          secondary={scope?.userActive ?? 0}
          secondaryLabel={s.org.kpi.users.secondaryLabel}
        />
        <SplitKpiCard
          tone="blue"
          icon="▤"
          caption={s.org.kpi.forms.caption}
          title={s.org.kpi.forms.title}
          primary={scope?.templateTotal ?? 0}
          primaryLabel={s.org.kpi.forms.primaryLabel}
          secondary={scope?.templatePrintable ?? 0}
          secondaryLabel={s.org.kpi.forms.secondaryLabel}
        />
        <SplitKpiCard
          tone="green"
          icon="▧"
          caption={s.org.kpi.documents.caption}
          title={s.org.kpi.documents.title}
          primary={scope?.documentTotal ?? 0}
          primaryLabel={s.org.kpi.documents.primaryLabel}
          secondary={scope?.documentConfirmed ?? 0}
          secondaryLabel={s.org.kpi.documents.secondaryLabel}
        />
        <SplitKpiCard
          tone="amber"
          icon="!"
          caption={s.org.kpi.needsAction.caption}
          title={s.org.kpi.needsAction.title}
          primary={scope?.documentWriting ?? 0}
          primaryLabel={s.org.kpi.needsAction.primaryLabel}
          secondary={scope?.documentNeedsReviewFields ?? 0}
          secondaryLabel={s.org.kpi.needsAction.secondaryLabel}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="text-sm font-medium text-[var(--foreground)]">{s.org.recentDocuments.title}</div>
            <Link href="/documents" className="text-xs text-[var(--color-brand-600)] hover:underline">
              {s.org.recentDocuments.viewAll}
            </Link>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.org.recentDocuments.table.docNo}</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.org.recentDocuments.table.form}</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.org.recentDocuments.table.owner}</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.org.recentDocuments.table.status}</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.org.recentDocuments.table.lastUpdated}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {recentDocuments.slice(0, 5).map((d) => {
                const statusLabel = s.status[d.status];
                return (
                  <tr key={d.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onOpenDocument(d.id)}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{d.ncode ?? d.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{d.templateVersion.template.name}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{d.org?.name ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge tone={STATUS_TONE[d.status]}>{statusLabel}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(d.createdAt).toLocaleString("ko-KR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {recentDocuments.length === 0 && <EmptyState>{s.org.recentDocuments.empty}</EmptyState>}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium text-[var(--foreground)] mb-3">{s.org.quickActions.title}</div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={onCreateBlank} disabled={creating}>
              {s.org.quickActions.createBlank}
            </Button>
            <Link href="/documents">
              <Button className="w-full">{s.org.quickActions.importPen}</Button>
            </Link>
            <Link href="/templates">
              <Button className="w-full">{s.org.quickActions.openTemplates}</Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-slate-400">AI OCR USAGE</div>
            <div className="text-sm font-medium text-[var(--foreground)]">{s.org.usageCard.title}</div>
          </div>
          <span className="text-xs text-slate-400">{s.org.usageCard.thisMonth}</span>
        </div>
        <UsageMeter usage={scope?.usage} s={s} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RankingCard
          eyebrow="TOP USERS"
          title={s.org.ranking.topUsers.title}
          period={s.org.ranking.topUsers.period}
          items={(scope?.topUsers ?? []).map((u) => ({ label: u.name, count: s.count.geon(u.count) }))}
          empty={s.rankingEmpty}
        />
        <RankingCard
          eyebrow="TOP FORMS"
          title={s.org.ranking.topForms.title}
          period={s.org.ranking.topForms.period}
          items={(scope?.topTemplates ?? []).map((t) => ({ label: t.name, count: s.count.geon(t.count) }))}
          empty={s.rankingEmpty}
        />
      </div>
    </>
  );
}

function SystemDashboard({ scope, s }: { scope: SystemScope | null; s: Strings }) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <SimpleKpiCard tone="blue" icon="▦" caption="TENANT" value={scope?.orgCount ?? 0} title={s.system.kpi.tenants.title} desc={s.system.kpi.tenants.desc} />
        <SimpleKpiCard tone="navy" icon="♙" caption="USER" value={scope?.userTotal ?? 0} title={s.system.kpi.users.title} desc={s.system.kpi.users.desc} />
        <SimpleKpiCard tone="green" icon="●" caption="ACTIVE" value={scope?.userActive ?? 0} title={s.system.kpi.active.title} desc={s.system.kpi.active.desc} />
        <SimpleKpiCard tone="green" icon="＋" caption="NEW" value={scope?.newOrgs30d ?? 0} title={s.system.kpi.newOrgs.title} desc={s.system.kpi.newOrgs.desc} />
        <SimpleKpiCard tone="amber" icon="−" caption="CHURN" value={scope?.churnedOrgs30d ?? 0} title={s.system.kpi.churnedOrgs.title} desc={s.system.kpi.churnedOrgs.desc} />
      </div>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-slate-400">PLATFORM AI USAGE</div>
            <div className="text-sm font-medium text-[var(--foreground)]">{s.system.usageCard.title}</div>
          </div>
          <span className="text-xs text-slate-400">{s.system.usageCard.thisMonth}</span>
        </div>
        <UsageMeter usage={scope?.usage} s={s} />
        <div className="mt-4">
          <div className="text-xs text-slate-400 mb-2">{s.system.usageCard.monthlyRequests}</div>
          <div className="flex items-end gap-2 h-20">
            {(scope?.monthlyBars ?? []).map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t bg-[var(--color-brand-500)]" style={{ height: `${Math.max(b.pct, 2)}%` }} title={s.count.geon(b.count)} />
                <span className="text-[10px] text-slate-400">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden mb-6">
        <div className="px-5 pt-4 pb-2">
          <div className="text-xs text-slate-400">TENANT USAGE</div>
          <div className="text-sm font-medium text-[var(--foreground)]">{s.system.tenantTable.title}</div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.system.tenantTable.headers.tenant}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.system.tenantTable.headers.registeredUsers}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.system.tenantTable.headers.activeUsers}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.system.tenantTable.headers.ocrDocs}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.system.tenantTable.headers.ocrPages}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.system.tenantTable.headers.successRate}</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">{s.system.tenantTable.headers.monthlyQuota}</th>
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
                <td className="px-4 py-3 text-slate-500">{s.count.pct(o.usage.successRate)}</td>
                <td className="px-4 py-3">
                  <Badge tone={(o.usage.quotaPct ?? 0) >= 80 ? "amber" : "slate"}>{Math.round(o.usage.quotaPct ?? 0)}%</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {(!scope || scope.perOrg.length === 0) && <EmptyState>{s.system.tenantTable.empty}</EmptyState>}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RankingCard
          eyebrow="TOP OCR TENANTS"
          title={s.system.ranking.topOcr.title}
          period={s.system.ranking.topOcr.period}
          items={(scope?.topOcrTenants ?? []).map((o) => ({ label: o.orgName, count: s.count.page(o.usage.pagesUsed) }))}
          empty={s.rankingEmpty}
        />
        <RankingCard
          eyebrow="TOP DOCUMENT TENANTS"
          title={s.system.ranking.topDocuments.title}
          period={s.system.ranking.topDocuments.period}
          items={(scope?.topDocumentTenants ?? []).map((o) => ({ label: o.orgName, count: s.count.geon(o.documentTotal) }))}
          empty={s.rankingEmpty}
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

function UsageMeter({ usage, s }: { usage?: UsageStats; s: Strings }) {
  const pagesUsed = usage?.pagesUsed ?? 0;
  const quota = usage?.quota ?? 1;
  const pct = Math.min(100, (pagesUsed / quota) * 100);
  return (
    <>
      <div className="flex items-baseline gap-2 mb-1">
        <strong className="text-2xl font-semibold text-[var(--foreground)]">{pagesUsed.toLocaleString()}</strong>
        <span className="text-sm text-slate-400">{s.usageMeter.quota(quota)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
        <div
          className={`h-full rounded-full ${pct >= 80 ? "bg-[var(--color-status-amber-fg)]" : "bg-[var(--color-brand-500)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mb-3">{s.usageMeter.usedPct(pct)}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <UsageStat label={s.usageMeter.stats.ocrDocs} value={s.count.geon(usage?.ocrDocuments ?? 0)} />
        <UsageStat label={s.usageMeter.stats.fieldsRecognized} value={s.count.gae(usage?.fieldsRecognized ?? 0)} />
        <UsageStat label={s.usageMeter.stats.successRate} value={s.count.pct(usage?.successRate ?? 100)} />
        <UsageStat label={s.usageMeter.stats.avgProcessing} value={s.count.sec(usage?.avgSeconds ?? null)} />
        <UsageStat label={s.usageMeter.stats.retried} value={s.count.geon(usage?.retried ?? 0)} />
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

function RankingCard({
  eyebrow,
  title,
  period,
  items,
  empty,
}: {
  eyebrow: string;
  title: string;
  period: string;
  items: { label: string; count: string }[];
  empty: string;
}) {
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
        <p className="text-sm text-slate-400">{empty}</p>
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
