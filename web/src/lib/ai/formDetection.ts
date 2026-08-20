// 양식 자동 추천 — 필기 OCR과는 별개의 AI 작업이다 (PRD_폼솔루션 §7.7.1).
// FormDetectionProvider 인터페이스만 안정적으로 유지하면 실제 구현(Gemini/Document AI/
// 다른 개발자가 만들고 있는 산출물)은 자유롭게 교체할 수 있다.

import { callGemini } from "./geminiClient";

export type DetectedFieldCandidate = {
  label: string;
  key: string;
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
          key: { type: "string" },
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
        required: ["label", "key", "type", "box", "confidence"],
      },
    },
  },
  required: ["fields"],
};

const PROMPT = `당신은 빈 종이 양식 이미지에서 사용자가 손으로 작성할 입력 영역을 찾는 도우미입니다.
이미지에서 사용자가 값을 적어 넣을 것으로 보이는 빈 칸/체크박스를 모두 찾아, 각 영역의
- label: 그 칸 바로 옆이나 위에 인쇄된 라벨 텍스트 (원문 언어 그대로, 번역하지 않음)
- key: label의 의미를 실제로 번역한 영문 snake_case 식별자. 소문자 영문자·숫자·밑줄만
  사용하고 숫자로 시작하지 않습니다. 발음을 로마자로 옮기지 말고 뜻을 번역하세요
  (예: "生年月日"→"date_of_birth", "男性"→"male", "電話番号"→"phone_number",
  "会社・団体名"→"company_name"). 같은 후보 안에서 중복되지 않게 하세요.
- type: "text"(문자 입력), "number"(숫자만), "date"(날짜), "time"(시간), "check"(체크박스/동그라미 표시),
  "choice"(라디오·다중선택 등 여러 항목 중 고르는 칸) 중 하나
- box: 페이지 전체 크기를 1로 봤을 때 0~1 정규화 좌표 {x, y, w, h} (x,y는 좌상단 기준)
- confidence: 실제 확신 정도를 반영한 0~1 사이 숫자. 애매하면 낮게 매기세요(이 값으로 후보를
  걸러냅니다 — 모든 후보에 0.9 같은 고정값을 넣지 마세요).

다음은 반드시 제외하세요:
- 이미 인쇄되어 있는 고정 텍스트(제목, 안내문, 문서 번호, 발행일처럼 시스템이 채우는 항목)
- 실제로 손으로 쓸 빈 공간(밑줄·빈 칸·박스 테두리)이 옆에 보이지 않는, 인쇄된 글자 하나만 있는 영역
  (예: 제목 근처의 "年 月 日" 같은 날짜 서식 안내 텍스트는 그 옆에 실제 빈칸이 없으면 필드가 아닙니다)
- 하나의 값을 "年"/"月"/"日"처럼 낱글자로 쪼개 각각 별도 필드로 만드는 것 — 실제로 연/월/일을
  각각 다른 칸에 쓰게 되어 있는 경우가 아니라면 하나의 date 필드로 합쳐서 반환하세요.`;

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
