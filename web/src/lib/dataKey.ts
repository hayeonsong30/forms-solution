// 라벨 → 데이터 키 자동 생성 (PRD_폼솔루션 §7.3: 사용자는 고급 설정에서만 수정)
// 데이터 키는 CSV 헤더·JSON 속성명으로 쓰이므로 항상 영문/숫자/밑줄만 허용한다.
// 라벨이 한글·일본어 등 로마자가 아니면 자동 번역 대신 유형 기반 영문 키로 대체한다
// (PRD_양식편집기_상세 §7.1 기본 생성값 예시 "key": "text_001"와 동일한 방식).
export function slugifyDataKey(label: string, fallback = "field"): string {
  const hasLatin = /[a-zA-Z]/.test(label);
  if (hasLatin) {
    const slug = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (slug) return slug;
  }
  return fallback;
}

export function withUniqueSuffix(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}
