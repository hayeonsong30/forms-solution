// 라벨 → 데이터 키 자동 생성 (PRD_폼솔루션 §7.3: 사용자는 고급 설정에서만 수정)
export function slugifyDataKey(label: string): string {
  const romanized = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return romanized || "field";
}

export function withUniqueSuffix(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}
