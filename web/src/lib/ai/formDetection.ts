// 양식 자동 추천 — 필기 OCR과는 별개의 AI 작업이다 (PRD_폼솔루션 §7.7.1).
// FormDetectionProvider 인터페이스만 안정적으로 유지하면 실제 구현(Gemini/Document AI/
// 다른 개발자가 만들고 있는 산출물)은 자유롭게 교체할 수 있다.

import { callGemini } from "./geminiClient";

export type DetectedFieldCandidate = {
  label: string;
  type: "text" | "number" | "check" | "date" | "time" | "choice";
  box: { x: number; y: number; w: number; h: number };
  confidence: number;
};

export interface FormDetectionProvider {
  detect(input: { imageBase64: string; mimeType: string }): Promise<DetectedFieldCandidate[]>;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          type: { type: "string", enum: ["text", "number", "check", "date", "time", "choice"] },
          box: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
            required: ["x", "y", "w", "h"],
          },
          confidence: { type: "number" },
        },
        required: ["label", "type", "box", "confidence"],
      },
    },
  },
  required: ["fields"],
};

const PROMPT = `당신은 빈 종이 양식 이미지에서 사용자가 손으로 작성할 입력 영역을 찾는 도우미입니다.
이미지에서 사용자가 값을 적어 넣을 것으로 보이는 빈 칸/체크박스를 모두 찾아, 각 영역의
- label: 그 칸 바로 옆이나 위에 인쇄된 라벨 텍스트
- type: "text"(문자 입력), "number"(숫자만), "date"(날짜), "time"(시간), "check"(체크박스/동그라미 표시),
  "choice"(라디오·다중선택 등 여러 항목 중 고르는 칸) 중 하나
- box: 페이지 전체 크기를 1로 봤을 때 0~1 정규화 좌표 {x, y, w, h} (x,y는 좌상단 기준)
- confidence: 0~1 사이 확신도
를 JSON으로 반환하세요. 이미 인쇄되어 있는 고정 텍스트(제목, 안내문 등)는 포함하지 마세요.`;

class GeminiFormDetectionProvider implements FormDetectionProvider {
  async detect(input: { imageBase64: string; mimeType: string }): Promise<DetectedFieldCandidate[]> {
    const result = await callGemini({
      parts: [{ text: PROMPT }, { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } }],
      responseSchema: RESPONSE_SCHEMA,
    });
    const parsed = result.json as { fields?: DetectedFieldCandidate[] };
    return parsed.fields ?? [];
  }
}

export const formDetectionProvider: FormDetectionProvider = new GeminiFormDetectionProvider();
