// 서버 전용 Gemini 호출 래퍼 (PRD_폼솔루션 §7.7.4). 브라우저에서 직접 호출하지 않는다 —
// 이 파일은 API 라우트(서버)에서만 import 한다.

export class GeminiError extends Error {}

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type GeminiCallOptions = {
  parts: GeminiPart[];
  responseSchema?: object;
};

export type GeminiCallResult = {
  json: unknown;
  model: string;
  usage: { promptTokens: number; candidatesTokens: number; totalTokens: number };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// PRD §7.7.17: API 시간초과 지수 백오프 최대 AI_MAX_RETRY회, 잘못된 JSON은 복구 1회 후 실패 처리.
export async function callGemini(opts: GeminiCallOptions): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY not configured");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const maxRetry = Number(process.env.AI_MAX_RETRY ?? 2);
  const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 60000);

  const body = {
    contents: [{ parts: opts.parts }],
    generationConfig: {
      responseMimeType: "application/json",
      // 구조화 추출 작업이라 깊은 추론이 필요 없다 — thinking을 끄면 응답이 수 배 빨라지고
      // 토큰 비용도 줄어든다 (2.5 Flash는 기본적으로 thinking이 켜져 있다).
      thinkingConfig: { thinkingBudget: 0 },
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetry; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new GeminiError(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") throw new GeminiError("Gemini API returned no content");

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new GeminiError("Gemini returned invalid JSON");
      }

      return {
        json,
        model: data.modelVersion ?? model,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
          candidatesTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
        },
      };
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetry) await sleep(300 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr instanceof GeminiError) throw lastErr;
  throw new GeminiError(lastErr instanceof Error ? lastErr.message : "Gemini call failed");
}
