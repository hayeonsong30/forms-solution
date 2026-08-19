import { useEffect, useState } from 'react'
import { Sidebar, type PageKey } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Documents } from './pages/Documents'
import { FormEditor } from './pages/FormEditor'
import { IDENTITY } from './data/identity'
import type { Role } from './types'

const TITLES: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  documents: '문서 조회',
  editor: '양식 편집',
}

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [role, setRole] = useState<Role>('admin')
  const identity = IDENTITY[role]

  // 현장 사용자는 양식 편집 화면에 접근할 수 없음(PRD §3.3) — 역할 전환 중 그 화면에 있었다면 대시보드로 이동
  useEffect(() => {
    if (role === 'field' && page === 'editor') setPage('dashboard')
  }, [role, page])

  return (
    <div className="flex min-h-screen">
      <Sidebar page={page} onNavigate={setPage} role={role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 shrink-0 bg-panel border-b border-border flex items-center justify-between px-6">
          <div className="text-[13px] text-ink-sub">{TITLES[page]}</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#F1F2F6] rounded-lg p-0.5 text-[11.5px] font-semibold">
              {(['admin', 'field'] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    role === r ? 'bg-white shadow-sm text-primary' : 'text-ink-sub hover:text-ink'
                  }`}
                >
                  {IDENTITY[r].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-ink-sub">
              <div className="w-[26px] h-[26px] rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-[11px]">
                {identity.initial}
              </div>
              {identity.name}
            </div>
          </div>
        </div>
        <div className="p-6 overflow-y-auto">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'documents' && <Documents role={role} />}
          {page === 'editor' && role === 'admin' && <FormEditor />}
        </div>
      </div>
    </div>
  )
}
