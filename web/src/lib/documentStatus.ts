// PRD_폼솔루션 §8: 인쇄됨 → 필기 수신 → 처리 중 → 검수 필요 → 확정 → 추출 가능
// 예외: 처리 실패 → 오류 → 재처리 / 확정 → 사유 입력 후 재검수 → 검수 필요
import type { DocumentStatus } from "@/generated/prisma/client";

const TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  printed: ["received"],
  received: ["processing"],
  processing: ["review_required", "error"],
  review_required: ["confirmed"],
  confirmed: ["review_required"], // 재검수 (사유 입력 후)
  error: ["processing"], // 재처리
};

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
