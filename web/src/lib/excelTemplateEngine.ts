// PRD_Excel_플레이스홀더_간단버전 §9, §14: 고객이 올린 .xlsx 안의 [데이터키] 플레이스홀더를
// 찾아 검증하고(inspect), 최종 확정값으로 치환한다(render). 서식·병합·행높이·열너비는
// exceljs가 셀 값만 바꾸는 한 그대로 보존된다 — 워크북/셀 객체를 재생성하지 않는다.
import ExcelJS from "exceljs";

export type PlaceholderHit = { key: string; sheet: string; cell: string };
export type PlaceholderErrorCode =
  | "UNKNOWN_PLACEHOLDER"
  | "INVALID_PLACEHOLDER_SYNTAX"
  | "REPEAT_FIELD_NOT_SUPPORTED";
export type PlaceholderError = {
  code: PlaceholderErrorCode;
  key: string;
  sheet: string;
  cell: string;
  suggestedKey?: string;
};
export type ExcelTemplateValidation = {
  status: "valid" | "invalid";
  validPlaceholders: PlaceholderHit[];
  errors: PlaceholderError[];
};

// 반복행(그룹) 데이터는 동적으로 행을 복제하지 않고, 고객 엑셀에 행 번호가 이미 고정으로
// 박혀있는 [데이터키.01], [데이터키.02]... 형태의 "고정 슬롯" 플레이스홀더로 지원한다
// (DigiDox 참고 — 반복 시작/종료 문법 없이 컬럼×최대행수만큼 개별 키를 그대로 나열).
// [group.column]처럼 숫자가 아닌 두 번째 구간은 여전히 미지원 문법으로 취급한다.
const UNSUPPORTED_DOTTED_RE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const VALID_KEY_RE = /^[a-z][a-z0-9_]*(\.\d{1,3})?$/;
const BRACKET_RE = /\[([^[\]]*)\]/g;

function cellText(value: ExcelJS.CellValue): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "richText" in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  }
  return null;
}

export async function inspectExcelTemplate(fileBuffer: Buffer, allowedKeys: string[]): Promise<ExcelTemplateValidation> {
  const allowed = new Set(allowedKeys);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);

  const validPlaceholders: PlaceholderHit[] = [];
  const errors: PlaceholderError[] = [];

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const text = cellText(cell.value);
        if (!text || !text.includes("[")) return;
        for (const m of text.matchAll(BRACKET_RE)) {
          const inner = m[1];
          const cellAddr = cell.address;
          if (UNSUPPORTED_DOTTED_RE.test(inner)) {
            errors.push({ code: "REPEAT_FIELD_NOT_SUPPORTED", key: inner, sheet: sheet.name, cell: cellAddr });
          } else if (!VALID_KEY_RE.test(inner)) {
            errors.push({ code: "INVALID_PLACEHOLDER_SYNTAX", key: inner, sheet: sheet.name, cell: cellAddr });
          } else if (!allowed.has(inner)) {
            errors.push({
              code: "UNKNOWN_PLACEHOLDER",
              key: inner,
              sheet: sheet.name,
              cell: cellAddr,
              suggestedKey: closestKey(inner, allowed),
            });
          } else {
            validPlaceholders.push({ key: inner, sheet: sheet.name, cell: cellAddr });
          }
        }
      });
    });
  });

  return { status: errors.length === 0 ? "valid" : "invalid", validPlaceholders, errors };
}

export async function renderExcelTemplate(fileBuffer: Buffer, values: Record<string, string>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const text = cellText(cell.value);
        if (!text || !text.includes("[")) return;
        // 셀 전체가 플레이스홀더 하나뿐이면 값 타입 그대로(숫자 등) 쓴다. 그 외엔 문자열 치환.
        const whole = /^\[([a-z][a-z0-9_]*(?:\.\d{1,3})?)\]$/.exec(text.trim());
        if (whole) {
          cell.value = values[whole[1]] ?? "";
          return;
        }
        cell.value = text.replace(/\[([a-z][a-z0-9_]*(?:\.\d{1,3})?)\]/g, (_, key: string) => values[key] ?? "");
      });
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function closestKey(input: string, allowed: Set<string>): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const k of allowed) {
    const d = levenshtein(input, k);
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return bestDist <= 2 ? best : undefined;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
