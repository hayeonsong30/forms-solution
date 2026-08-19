// 필기 OCR — 양식 자동 추천과는 별개의 AI 작업이다 (PRD_폼솔루션 §7.7.1, §7.7.3).
// 체크/라디오는 원칙적으로 펜 획 규칙이 우선이지만(§7.7.3 역할 분담표), 스마트펜 실시간
// 좌표 스트림이 아직 없는 이번 스텁 단계에서는 이미지 기반 Gemini 판정으로 대체한다.

import { callGemini } from "./geminiClient";

export type OcrFieldRequest = {
  dataKey: string;
  label: string;
  type: "text" | "number" | "check";
};

export type OcrFieldResult = {
  dataKey: string;
  rawValue: string | null;
  confidence: number;
};

export interface HandwritingOcrProvider {
  recognize(input: {
    imageBase64: string;
    mimeType: string;
    fields: OcrFieldRequest[];
  }): Promise<OcrFieldResult[]>;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    values: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dataKey: { type: "string" },
          rawValue: { type: "string", nullable: true },
          confidence: { type: "number" },
        },
        required: ["dataKey", "rawValue", "confidence"],
      },
    },
  },
  required: ["values"],
};

function buildPrompt(fields: OcrFieldRequest[]): string {
  const fieldList = fields.map((f) => `- dataKey="${f.dataKey}" label="${f.label}" type=${f.type}`).join("\n");
  return `이미지는 사용자가 손으로 작성한 문서 페이지입니다. 아래 필드 목록 각각에 대해
해당 위치에 손으로 적힌 값을 읽어 JSON으로 반환하세요.

${fieldList}

규칙:
- type="number" 필드는 숫자만 rawValue에 담되, 읽은 그대로(오타 포함) 문자열로 반환하세요.
- type="check" 필드는 체크/동그라미가 표시되어 있으면 "true", 표시가 없으면 "false", 판독 불가면 null을 반환하세요.
- 값을 전혀 찾을 수 없으면 rawValue를 null로 하세요.
- confidence는 0~1 사이 확신도입니다.
- 이미지에 없는 필드는 만들지 말고, 목록에 있는 dataKey만 그대로 사용하세요.`;
}

class GeminiHandwritingOcrProvider implements HandwritingOcrProvider {
  async recognize(input: {
    imageBase64: string;
    mimeType: string;
    fields: OcrFieldRequest[];
  }): Promise<OcrFieldResult[]> {
    if (input.fields.length === 0) return [];
    const result = await callGemini({
      parts: [
        { text: buildPrompt(input.fields) },
        { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
      ],
      responseSchema: RESPONSE_SCHEMA,
    });
    const parsed = result.json as { values?: OcrFieldResult[] };
    return parsed.values ?? [];
  }
}

export const handwritingOcrProvider: HandwritingOcrProvider = new GeminiHandwritingOcrProvider();
