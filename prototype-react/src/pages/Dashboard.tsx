import { Card, Badge } from '../components/ui'
import { documents } from '../data/sampleData'
import type { PageKey } from '../components/Sidebar'

const stats = [
  { label: '총 업로드 문서', value: '958', sub: '오늘 +12', icon: '↥', bg: 'bg-primary-soft', color: 'text-primary' },
  { label: '처리 대기', value: '3', sub: 'AI 추출 진행 중', icon: '⏳', bg: 'bg-warn-soft', color: 'text-[#B4740E]' },
  { label: '오늘 추출 완료', value: '124', sub: '평균 2.1초', icon: '✓', bg: 'bg-accent-soft', color: 'text-[#0B8F63]' },
  { label: '반복행 사용 양식', value: '18 / 41', sub: '전체 양식 중 비율', icon: '▥', bg: 'bg-new-soft', color: 'text-new' },
]

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  return (
    <section>
      <div className="mb-[18px]">
        <h1 className="text-[19px] font-bold tracking-tight">Dashboard</h1>
        <p className="text-[12.5px] text-ink-sub mt-0.5">전체 현황 요약 및 최근 업로드 문서</p>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-[18px]">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-semibold text-ink-sub">{s.label}</div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[15px] ${s.bg} ${s.color}`}>{s.icon}</div>
            </div>
            <div className="text-2xl font-extrabold tracking-tight">{s.value}</div>
            <div className="text-[11.5px] text-ink-faint mt-1">{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="p-[18px]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-[14.5px] font-bold">최근 업로드 문서</div>
            <div className="text-xs text-ink-sub mb-3.5">필기 데이터가 포함된 최신 문서 — 클릭하면 조회 화면으로 이동합니다</div>
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] font-bold text-ink-sub uppercase tracking-wide border-b border-border bg-[#FAFBFC]">
              <th className="px-3.5 py-2.5">문서번호</th>
              <th className="px-3.5 py-2.5">양식</th>
              <th className="px-3.5 py-2.5">작성자</th>
              <th className="px-3.5 py-2.5">상태</th>
              <th className="px-3.5 py-2.5">기입된 Lot</th>
              <th className="px-3.5 py-2.5">시각</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr
                key={d.id}
                onClick={() => onNavigate('documents')}
                className="border-b border-border last:border-none text-[12.5px] hover:bg-[#FAFAFE] cursor-pointer"
              >
                <td className="px-3.5 py-2.5 font-semibold text-primary">{d.id}</td>
                <td className="px-3.5 py-2.5">{d.formId} · {d.formName}</td>
                <td className="px-3.5 py-2.5">{d.owner}</td>
                <td className="px-3.5 py-2.5">
                  <Badge color={d.status === 'Complete' ? 'green' : d.status === 'Write' ? 'amber' : 'blue'}>{d.status}</Badge>
                </td>
                <td className="px-3.5 py-2.5">{d.rows.length}행</td>
                <td className="px-3.5 py-2.5 whitespace-nowrap">{d.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  )
}
