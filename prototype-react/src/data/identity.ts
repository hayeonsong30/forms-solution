import type { Role } from '../types'

// 실제 로그인 없이 역할별 화면 차이를 보여주기 위한 데모용 신원.
// PRD §3.2(고객사 관리자) / §3.3(현장 사용자) — 같은 고객사 콘솔, 역할에 따라 메뉴·데이터 범위만 다름.
export const IDENTITY: Record<Role, { name: string; label: string; initial: string }> = {
  admin: { name: '네오랩', label: '고객사 관리자', initial: '네' },
  field: { name: '田中 太郎', label: '현장 사용자', initial: '田' },
}
