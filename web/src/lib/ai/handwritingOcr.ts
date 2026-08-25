// 필기 OCR — 양식 자동 추천과는 별개의 AI 작업이다 (PRD_폼솔루션 §7.7.1, §7.7.3).
// 체크/라디오는 원칙적으로 펜 획 규칙이 우선이지만(§7.7.3 역할 분담표), 스마트펜 실시간
// 좌표 스트림이 아직 없는 이번 스텁 단계에서는 이미지 기반 Gemini 판정으로 대체한다.

import { callGemini } from "./geminiClient";
import type { FieldConfig } from "@/types";

export type OcrFieldRequest = {
  dataKey: string;
  label: string;
  type: "text" | "number" | "check" | "date" | "time" | "choice";
  // 편집기에서 이미 잡아둔 페이지 상대(0~1) 좌표. 필드 수가 많은 페이지에서 라벨 의미만으로
  // 이미지 전체를 훑게 하면 엉뚱한 값을 집어오기 쉬워서, 각 필드가 어디쯤 있는지 힌트로
  // 같이 준다 — 실제 잘라내기(crop)는 아니고 프롬프트상의 위치 힌트다.
  box?: { x: number; y: number; w: number; h: number };
  // 편집기에서 설정한 필드별 판정 규칙(체크 판정 기호, 날짜 입력형식, 문자 정책 등).
  // 타입별 공통 규칙만으로는 사용자가 커스텀한 설정(예: trueMarks를 "V"가 아니라
  // "CHECK"로 바꾼 경우)을 반영할 수 없어서, 있으면 이 값을 최우선으로 따르게 한다.
  config?: FieldConfig;
  // choice 필드의 유효 옵션. Gemini가 임의의 라벨 텍스트가 아니라 이 storedValue를 그대로
  // 반환하게 해서, 이후 검증(fieldValueValidation)이 실제 저장값과 비교할 수 있게 한다.
  choiceOptions?: { label: string; storedValue: string }[];
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

// 필드별로 편집기에서 실제 설정한 값만 뽑아 사람이 읽을 수 있는 규칙 문자열로 바꾼다.
// 여기 없는 항목(설정 안 함)은 프롬프트에 아예 안 실어서, 공통 기본 규칙이 자연스럽게
// 적용되게 둔다 — 빈 값까지 나열하면 프롬프트만 길어지고 신호가 흐려진다.
function configNote(f: OcrFieldRequest): string {
  const c = f.config;
  if (!c) return "";
  const parts: string[] = [];
  if (f.type === "text" && c.text) {
    const t = c.text;
    if (t.charPolicy && t.charPolicy !== "all") parts.push(`허용 문자=${t.charPolicy}`);
    if (t.maxLength) parts.push(`최대길이=${t.maxLength}`);
    if (t.writingMode === "multiline") parts.push("여러 줄 입력 가능");
    if (t.preserveNewline) parts.push("줄바꿈 그대로 보존");
    if (t.preserveWhitespace) parts.push("공백 그대로 보존");
  }
  if (f.type === "number" && c.number) {
    const n = c.number;
    if (n.numberFormat) parts.push(`형식=${n.numberFormat}`);
    if (n.decimalPlaces) parts.push(`소수 자리수=${n.decimalPlaces}`);
    if (n.allowNegative) parts.push("음수 허용");
    if (n.min !== undefined) parts.push(`최소=${n.min}`);
    if (n.max !== undefined) parts.push(`최대=${n.max}`);
    if (n.unit) parts.push(`단위=${n.unit}`);
  }
  if (f.type === "check" && c.check) {
    const ch = c.check;
    if (ch.mode) parts.push(`판정모드=${ch.mode}`);
    if (ch.trueMarks?.length) parts.push(`true로 볼 표시=[${ch.trueMarks.join(", ")}]`);
    if (ch.falseMarks?.length) parts.push(`false로 볼 표시=[${ch.falseMarks.join(", ")}]`);
    if (ch.blankValue) parts.push(`빈칸 처리=${ch.blankValue}`);
    // symbol 모드: true/false로 뭉개지 말고 실제로 그려진 기호 문자 그대로 반환하게 한다.
    if (ch.outputMode === "symbol") {
      parts.push(
        `출력형식=true/false로 바꾸지 말고 실제로 그려진 기호를 위 표시 목록 중 하나로 그대로 rawValue에 반환(예: "${
          ch.trueMarks?.[0] ?? "V"
        }" 또는 "${ch.falseMarks?.[0] ?? "X"}"), 아무 표시도 없으면 null`
      );
    }
  }
  if (f.type === "date" && c.date) {
    const d = c.date;
    if (d.inputFormat && d.inputFormat !== "auto") parts.push(`입력형식=${d.inputFormat}`);
  }
  if (f.type === "time" && c.time) {
    const t = c.time;
    if (t.inputMode && t.inputMode !== "auto") parts.push(`입력형식=${t.inputMode}`);
  }
  if (f.type === "choice" && c.choice) {
    parts.push(c.choice.mode === "multiple" ? "복수 선택 가능" : "단일 선택만 가능");
  }
  return parts.length > 0 ? ` config={${parts.join(", ")}}` : "";
}

function buildPrompt(fields: OcrFieldRequest[]): string {
  const fieldList = fields
    .map((f) => {
      const optionsNote =
        f.type === "choice" && f.choiceOptions && f.choiceOptions.length > 0
          ? ` options=[${f.choiceOptions.map((o) => `${o.storedValue}(${o.label})`).join(", ")}]`
          : "";
      const boxNote = f.box
        ? ` region=(x:${f.box.x.toFixed(3)}, y:${f.box.y.toFixed(3)}, w:${f.box.w.toFixed(3)}, h:${f.box.h.toFixed(3)})`
        : "";
      return `- dataKey="${f.dataKey}" label="${f.label}" type=${f.type}${boxNote}${optionsNote}${configNote(f)}`;
    })
    .join("\n");
  return `이미지는 사용자가 손으로 작성한 문서 페이지입니다. 아래 필드 목록 각각에 대해
해당 위치에 손으로 적힌 값을 읽어 JSON으로 반환하세요.

각 필드의 region은 이미지 전체를 기준으로 한 정규화 좌표입니다 — x/y는 좌상단 기준
0~1 비율(왼쪽 위 모서리), w/h는 그 위치에서부터의 너비·높이 비율입니다. 예를 들어
x:0.2, y:0.3, w:0.3, h:0.05는 이미지 가로의 20~50%, 세로의 30~35% 사각형 영역을
뜻합니다. 라벨 텍스트만으로 이미지 전체를 훑지 말고, 이 region이 가리키는 위치와
그 주변에 실제로 적힌 손글씨를 우선적으로 읽으세요 — 값이 region 안에 없다면 그 필드는
null로 두고, 다른 필드의 값을 대신 넣지 마세요.

각 필드의 config는 편집기에서 사용자가 직접 설정한 판정 규칙입니다 — 아래 공통 규칙보다
config를 항상 우선하세요. config가 없는 필드에만 아래 공통 규칙을 적용하세요.

${fieldList}

공통 규칙 (config로 지정되지 않은 필드에만 적용):
- type="number" 필드는 숫자만 rawValue에 담되, 읽은 그대로(오타 포함) 문자열로 반환하세요.
- type="check" 필드는 체크/동그라미가 표시되어 있으면 "true", 표시가 없으면 "false", 판독 불가면 null을 반환하세요.
- type="date" 필드는 읽은 그대로(예: "2026年8月19日", "8/19") 문자열로 반환하세요.
- type="time" 필드는 읽은 그대로(예: "14:30", "2시 30분") 문자열로 반환하세요.
- type="choice" 필드는 options 목록에 주어진 storedValue(괄호 안은 참고용 라벨)만 그대로
  반환하세요 — 라벨 텍스트나 새로 만든 값을 쓰지 마세요. 표시된 옵션이 여러 개면 쉼표로
  구분한 storedValue 목록을 반환하고(표시된 순서대로), 표시된 게 없으면 null을 반환하세요.

모든 필드 공통:
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
