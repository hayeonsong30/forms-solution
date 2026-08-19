import { IDENTITY } from '../data/identity'
import type { Role } from '../types'

export type PageKey = 'dashboard' | 'documents' | 'editor'

const NAV: { key: PageKey; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '◧' },
  { key: 'documents', label: '문서 조회', icon: '▤' },
  { key: 'editor', label: '양식 편집', icon: '▥', adminOnly: true },
]

export function Sidebar({
  page,
  onNavigate,
  role,
}: {
  page: PageKey
  onNavigate: (p: PageKey) => void
  role: Role
}) {
  const nav = NAV.filter((item) => !item.adminOnly || role === 'admin')

  return (
    <aside className="w-[236px] shrink-0 bg-sidebar text-white flex flex-col py-5">
      <div className="flex items-center gap-2.5 px-5 pb-4 mb-1.5 border-b border-white/10">
        <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-primary to-[#8B5CF6] flex items-center justify-center font-bold text-sm">
          FS
        </div>
        <div>
          <div className="font-bold text-[15px] tracking-tight">Form Solution</div>
          <div className="text-[10.5px] text-sidebar-sub mt-0.5">AI 필드 인식 프로토타입</div>
        </div>
      </div>

      <nav className="mt-2.5 px-3 flex flex-col gap-0.5">
        {nav.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-medium text-left transition-colors ${
              page === item.key ? 'bg-sidebar-active text-white' : 'text-sidebar-sub hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="w-[18px] text-center opacity-90">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-3.5 px-5 border-t border-white/10">
        <div className="text-xs text-sidebar-sub py-1.5">{IDENTITY[role].label}</div>
        <div className="text-xs text-[#5B6072] py-1.5">v0.1 · React 프로토타입</div>
      </div>
    </aside>
  )
}
