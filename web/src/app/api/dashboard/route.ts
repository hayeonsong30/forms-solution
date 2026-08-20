import { prisma } from "@/lib/prisma";

// PRD_폼솔루션 §6.1.1 + 프로토타입 index.html 대시보드 뷰(고정 목업)를 실제 데이터로
// 재현한다. 프로토타입에는 있지만 우리 DB에 원천적으로 없는 값(고객사 해지, AI 비용,
// 사용자 활성 상태 자체)은 숫자를 지어내지 않고 0이나 "-"로 정직하게 비워 둔다.
// 월 OCR 페이지 한도는 실제 과금 시스템이 아직 없어 데모용 상수로 둔다.
const MONTHLY_OCR_PAGE_QUOTA = 1000;

type DocRow = {
  id: string;
  orgId: string;
  status: string;
  createdAt: Date;
  confirmedById: string | null;
  templateVersion: { pageCount: number; template: { name: string } };
};
type AiJobRow = {
  id: string;
  documentId: string | null;
  status: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  document: { orgId: string } | null;
};

function ocrUsage(jobs: AiJobRow[], documents: DocRow[], aiFieldValues: { documentId: string | null }[], monthStart: Date) {
  const monthlyJobs = jobs.filter((j) => j.createdAt >= monthStart);
  const docById = new Map(documents.map((d) => [d.id, d]));
  const distinctMonthlyDocIds = new Set(monthlyJobs.map((j) => j.documentId).filter((x): x is string => Boolean(x)));
  const pagesUsed = [...distinctMonthlyDocIds].reduce((sum, docId) => sum + (docById.get(docId)?.templateVersion.pageCount ?? 1), 0);
  const completed = jobs.filter((j) => j.status === "completed");
  const failed = jobs.filter((j) => j.status === "failed");
  const successRate = jobs.length > 0 ? (completed.length / jobs.length) * 100 : 100;
  // 시드 데이터는 createdAt을 과거로 소급해 넣지만 updatedAt은 삽입 시각 그대로라 차이가
  // 며칠 단위로 벌어질 수 있다 — 1시간을 넘는 값은 실제 처리 시간이 아니므로 null로 둔다.
  const rawAvgSeconds =
    completed.length > 0
      ? completed.reduce((sum, j) => sum + (j.updatedAt.getTime() - j.createdAt.getTime()) / 1000, 0) / completed.length
      : 0;
  const avgSeconds = rawAvgSeconds > 3600 ? null : rawAvgSeconds;
  const retried = jobs.filter((j) => j.retryCount > 0).length;
  const fieldsRecognized = aiFieldValues.filter((fv) => distinctMonthlyDocIds.has(fv.documentId ?? "")).length;
  return {
    ocrDocuments: distinctMonthlyDocIds.size,
    pagesUsed,
    fieldsRecognized,
    successRate,
    avgSeconds,
    retried,
    failedCount: failed.length,
  };
}

export async function GET() {
  const [orgs, users, templates, documents, aiJobs, aiFieldValues, needsReviewRows] = await Promise.all([
    prisma.organization.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, orgId: true, role: true, name: true } }),
    prisma.template.findMany({ select: { id: true, orgId: true, status: true } }),
    prisma.document.findMany({
      select: {
        id: true,
        orgId: true,
        status: true,
        createdAt: true,
        confirmedById: true,
        templateVersion: { select: { pageCount: true, template: { select: { name: true } } } },
      },
    }),
    prisma.aiJob.findMany({
      select: {
        id: true,
        documentId: true,
        status: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true,
        document: { select: { orgId: true } },
      },
    }),
    // "인식 필드" 수: AI가 채운 값(사용자가 아직 덮어쓰지 않은 것 포함) 전체.
    prisma.fieldValue.findMany({ where: { valueSource: "ai" }, select: { documentId: true } }),
    prisma.fieldValue.findMany({ where: { reviewStatus: "needs_review" }, select: { documentId: true } }),
  ]);

  const docOrgOf = new Map(documents.map((d) => [d.id, d.orgId]));
  const needsReviewFieldCount = needsReviewRows.length;
  const needsReviewByOrg = new Map<string, number>();
  for (const r of needsReviewRows) {
    const orgId = r.documentId ? docOrgOf.get(r.documentId) : undefined;
    if (orgId) needsReviewByOrg.set(orgId, (needsReviewByOrg.get(orgId) ?? 0) + 1);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  function orgScope(orgId: string) {
    const orgTemplates = templates.filter((t) => t.orgId === orgId);
    const orgDocuments = documents.filter((d) => d.orgId === orgId);
    const orgUsers = users.filter((u) => u.orgId === orgId);
    const orgJobs = aiJobs.filter((j) => j.document?.orgId === orgId);
    const orgFieldValuesAi = aiFieldValues.filter((fv) => docOrgOf.get(fv.documentId ?? "") === orgId);

    const templateUsage = new Map<string, number>();
    const userUsage = new Map<string, { name: string; count: number }>();
    for (const d of orgDocuments) {
      const name = d.templateVersion.template.name;
      templateUsage.set(name, (templateUsage.get(name) ?? 0) + 1);
      if (d.confirmedById) {
        const u = orgUsers.find((x) => x.id === d.confirmedById);
        const entry = userUsage.get(d.confirmedById) ?? { name: u?.name ?? "-", count: 0 };
        entry.count += 1;
        userUsage.set(d.confirmedById, entry);
      }
    }
    // "활성 사용자": 최근 처리 이력(문서 확정)이 있는 사용자. 활동 이력이 전혀 없으면
    // 0명으로 단정할 근거가 없어 전체 등록 사용자 수를 그대로 보여준다.
    const activeUserIds = new Set(orgDocuments.map((d) => d.confirmedById).filter((x): x is string => Boolean(x)));
    const usage = ocrUsage(orgJobs, documents, orgFieldValuesAi, monthStart);

    return {
      orgId,
      orgName: orgs.find((o) => o.id === orgId)?.name ?? "-",
      userTotal: orgUsers.length,
      userActive: activeUserIds.size > 0 ? activeUserIds.size : orgUsers.length,
      templateTotal: orgTemplates.length,
      templatePrintable: orgTemplates.filter((t) => t.status === "printable").length,
      documentTotal: orgDocuments.length,
      documentConfirmed: orgDocuments.filter((d) => d.status === "confirmed").length,
      documentWriting: orgDocuments.filter((d) => d.status === "received" || d.status === "processing").length,
      documentNeedsReviewFields: needsReviewByOrg.get(orgId) ?? 0,
      usage: { ...usage, quota: MONTHLY_OCR_PAGE_QUOTA, quotaPct: (usage.pagesUsed / MONTHLY_OCR_PAGE_QUOTA) * 100 },
      topTemplates: [...templateUsage.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      topUsers: [...userUsage.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    };
  }

  const org = orgs.length > 0 ? orgScope(orgs[0].id) : null;
  const perOrg = orgs.map((o) => orgScope(o.id));

  const platformUsage = ocrUsage(aiJobs, documents, aiFieldValues, monthStart);
  const monthlyBars: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = aiJobs.filter((j) => j.createdAt >= start && j.createdAt < end).length;
    monthlyBars.push({ label: `${start.getMonth() + 1}월`, count });
  }
  const maxMonthly = Math.max(1, ...monthlyBars.map((b) => b.count));

  const activeUsersPlatform = (() => {
    const active = new Set(documents.map((d) => d.confirmedById).filter((x): x is string => Boolean(x))).size;
    return active > 0 ? active : users.length;
  })();

  const system = {
    orgCount: orgs.length,
    userTotal: users.length,
    userActive: activeUsersPlatform,
    newOrgs30d: orgs.filter((o) => o.createdAt >= thirtyDaysAgo).length,
    churnedOrgs30d: 0, // 고객사 사용 종료 상태를 아직 추적하지 않는다
    usage: { ...platformUsage, quota: MONTHLY_OCR_PAGE_QUOTA * Math.max(orgs.length, 1) },
    monthlyBars: monthlyBars.map((b) => ({ ...b, pct: Math.round((b.count / maxMonthly) * 100) })),
    needsReviewFieldCount,
    alerts: {
      quotaWarnOrgCount: perOrg.filter((o) => o.usage.quotaPct >= 80).length,
      failedJobCount: aiJobs.filter((j) => j.status === "failed").length,
    },
    perOrg,
    topOcrTenants: [...perOrg].sort((a, b) => b.usage.pagesUsed - a.usage.pagesUsed).slice(0, 5),
    topDocumentTenants: [...perOrg].sort((a, b) => b.documentTotal - a.documentTotal).slice(0, 5),
  };

  return Response.json({ org, system });
}
