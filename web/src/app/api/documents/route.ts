import { prisma } from "@/lib/prisma";
import type { DocumentStatus } from "@/generated/prisma/client";

// PRD_폼솔루션 §14.1: 동일 SOBP(ncode)로 여러 건이 들어온 경우(공유 SOBP) 목록에서는
// 1건으로 묶어 보여주고, "페이지"는 실제 들어온 스캔 수로 카운트한다. 공유가 아닌 일반
// 문서는 지금까지처럼 양식의 실제 페이지 수를 보여준다(스캔 건수=1로 뭉개지 않음).
const STATUS_PRIORITY: DocumentStatus[] = ["error", "review_required", "processing", "received", "printed", "confirmed"];

function representativeStatus(statuses: DocumentStatus[]): DocumentStatus {
  for (const s of STATUS_PRIORITY) {
    if (statuses.includes(s)) return s;
  }
  return statuses[0];
}

export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      templateVersionId: true,
      orgId: true,
      ncode: true,
      status: true,
      createdAt: true,
      receivedAt: true,
      confirmedAt: true,
      templateVersion: { select: { pageCount: true, template: { select: { id: true, name: true } } } },
      org: { select: { name: true } },
    },
  });

  // ncode가 있고 같은 ncode를 쓰는 문서가 2건 이상이면 그룹으로 묶는다.
  const byNcode = new Map<string, typeof documents>();
  for (const d of documents) {
    if (!d.ncode) continue;
    const list = byNcode.get(d.ncode) ?? [];
    list.push(d);
    byNcode.set(d.ncode, list);
  }

  const seen = new Set<string>();
  const result = [];
  for (const d of documents) {
    if (seen.has(d.id)) continue;
    const group = d.ncode ? byNcode.get(d.ncode) : undefined;
    if (group && group.length > 1) {
      group.forEach((g) => seen.add(g.id));
      // 대표 행: 그룹 안에서 가장 최근에 생성된 문서 정보를 목록에 보여준다(양식명 등은
      // 그룹 내에서 동일하다는 전제).
      const latest = group[group.length - 1];
      result.push({
        ...latest,
        status: representativeStatus(group.map((g) => g.status)),
        pageScanCount: group.length,
        groupIds: group.map((g) => g.id),
      });
    } else {
      seen.add(d.id);
      // 공유 SOBP가 아닌 일반 문서는 "페이지"에 실제 양식 페이지 수를 그대로 보여준다.
      result.push({ ...d, pageScanCount: d.templateVersion.pageCount, groupIds: [d.id] });
    }
  }

  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return Response.json(result);
}
