import type { OcrFieldInput, OcrProvider, OcrResult } from '../types'

// C단계(업로드 → 필드 크롭 → 검수 화면)가 이 인터페이스만 보고 동작하도록 하는 mock 구현체.
// E단계에서 recognize()만 실제 Gemini 호출로 교체하면 C·D단계 코드는 무수정으로 유지된다.
export const mockOcrProvider: OcrProvider = {
  async recognize({ label }: OcrFieldInput): Promise<OcrResult> {
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400))
    return {
      value: `(mock) ${label}`,
      confidence: 0.7 + Math.random() * 0.25,
    }
  },
}
