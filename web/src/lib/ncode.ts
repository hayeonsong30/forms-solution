// NCode 발급·회수·다매 인쇄 정책은 아직 미결정 (PRD_폼솔루션 §14 미결정#1 — 고토부키
// 다매 인쇄 요구와 매체별 추적성 충돌). 여기서는 유니크한 코드만 발급하는 임시 구현이다.
//
// 실제 SOBP는 Section.Owner.Book.Page, 점으로 구분된 4개 "숫자" 좌표다(NeoCAST
// `nc-paperhub.service.ts` 참고): Section=5 고정, Owner는 255에서 시작해 Book 소진 시
// 1씩 감소, Book/Page는 0에서 시작해 각각 최대 4095까지 순차 증가하며 이용자(userId)
// 단위로 DB에 할당 상태를 저장한다. 이 알고리즘·범위는 NeoLab이 폼솔루션용으로 공식
// 할당해줘야 나오는 값이라(project memory 참고) 실제 숫자를 흉내내면 안 된다 — 틀린
// 숫자가 진짜인 것처럼 보이는 게 더 위험하다. 그렇다고 형식 자체를 완전히 다르게
// 보여주면(예: 랜덤 UUID) 그것대로 오해를 준다 — "점 4개로 구분된 구조"라는 형식은
// 유지하되, 숫자 대신 문자로 채워서 "이 자리에 SOBP가 들어간다"는 것만 보여준다
// (2026-08-25, 사용자 확정: "문자로라도 형식에 맞게 표시").
function randomLetters(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 혼동되는 I/O 제외
  let out = "";
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function generateNcode(): string {
  return [randomLetters(1), randomLetters(3), randomLetters(4), randomLetters(4)].join(".");
}
