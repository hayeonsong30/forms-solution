// NCode 발급·회수·다매 인쇄 정책은 아직 미결정 (PRD_폼솔루션 §14 미결정#1 — 고토부키
// 다매 인쇄 요구와 매체별 추적성 충돌). 여기서는 유니크한 코드만 발급하는 임시 구현이다.
export function generateNcode(): string {
  return `N-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}
