# [AI-01] AI 자동 추천 및 OCR 파이프라인 명세서

## 0. 문서 이력 (Revision History)

- **v1.0** | 2026-08-28 | 송하연 | 최초 작성

---

## 1. 문서 개요

- **문서 목적**: 양식 필드 자동 추천과 필기 OCR의 내부 처리 규칙 정의
- **대상 기능**
  - 양식 이미지에서 입력 필드 후보 감지
  - 작성 문서에서 필드값 OCR
  - 유형별 값 정규화·검증
  - AI 작업 및 결과 저장
- **관련 화면**: FRM-02, DOC-01, DOC-02

> 필드 추천과 필기 OCR은 서로 다른 AI 작업이다. 각각 별도 프롬프트와 작업 유형을 사용한다.

| 구분 | 작업 유형 (`AiJob.jobType`) | 목적 |
|---|---|---|
| AI 자동 추천 | `form_detection` | 빈 양식에서 필드 후보 생성 |
| 필기 OCR | `handwriting_ocr` | 작성 문서에서 필드값 추출 |

---

## 2. 공통 AI 호출 정책

- 공급자: Gemini
- 모델: `GEMINI_MODEL`, 기본값 `gemini-2.5-flash`
- 구조화 응답 사용
- Thinking: 비활성(`thinkingBudget = 0`)
- 제한 시간: `AI_REQUEST_TIMEOUT_MS`, 기본 60초
- 재시도: `AI_MAX_RETRY`, 기본 2회
- 실패 시 지수 백오프 적용
- AI 호출 이력은 `AiJob`에 저장
  - 시작: `processing`
  - 성공: `completed`
  - 실패: `failed`

---

## 3. AI 자동 추천

### 3.1 실행 조건

- FRM-02의 `[✦ AI 자동 추천]` 클릭
- 양식 상태: `draft`
- PDF 업로드 완료
- 다른 AI 분석이 진행 중이지 않을 것
- 현재 페이지 1장만 분석

### 3.2 이미지 생성

- 현재 PDF 페이지를 브라우저에서 캡처
- 렌더링 폭: 1600px
- 형식: PNG Data URI
- 여러 페이지를 한 번에 분석하지 않음
- 생성된 이미지를 서버 API로 전송

### 3.3 API

- 요청: `POST /api/templates/{templateId}/ai-detection`
- Body: `{ imageDataUri, pageNo }`

**서버 처리 순서:**

1. 요청값 검증
2. 양식 상태 확인
3. PDF 존재 여부 확인
4. `form_detection` 작업 생성
5. Gemini 필드 감지 실행
6. 후보 신뢰도·영역 검증
7. 통과 후보를 `Field`로 저장
8. AI 작업 완료 처리

**사전 실패:**

| 조건 | 응답 |
|---|---|
| 양식이 `draft`가 아님 | `409 TEMPLATE_LOCKED` |
| PDF 없음 | `409 PDF_REQUIRED` |
| Gemini 분석 실패 | `502 AI_DETECTION_FAILED` |
| 그 외 서버 오류 | `500` |

### 3.4 감지 대상

- 손으로 값을 작성하는 빈칸
- 체크박스 또는 표시 영역
- 라벨과 실제 입력 영역이 함께 확인되는 항목
- 하나의 값으로 작성하는 날짜·시간은 하나의 필드로 감지

**제외 대상:**

- 제목·설명·고정 안내문
- 시스템에서 인쇄하는 문서번호·발행일
- 실제 입력 영역이 없는 라벨 텍스트
- 의미 없이 분리된 `년` / `월` / `일` 문자

### 3.5 AI 응답

필드 후보별 반환값:

| 값 | 설명 |
|---|---|
| `label` | 양식에 인쇄된 원문 라벨 |
| `key` | 의미를 번역한 영문 snake_case 데이터 키 |
| `type` | text / number / date / time / check / choice |
| `box` | 0~1 정규화 좌표 `{x, y, w, h}` |
| `confidence` | 0~1 신뢰도 |

### 3.6 후보 필터링

다음 조건을 모두 만족한 후보만 저장한다.

- 신뢰도 `0.4` 이상
- 박스 면적 `0.0003` 이상
- X·Y·Width·Height가 페이지 0~1 범위 안에 위치
- 박스 오른쪽·아래쪽이 페이지 영역을 벗어나지 않음

- 제외 후보 수는 `filteredOutCount`로 반환
- 제외 후보가 있으면 FRM-02에서 안내 배너 표시

### 3.7 필드 저장

- 데이터 키를 snake_case로 정리
- 기존 데이터 키와 중복되면 고유 접미사 추가
- 유형별 세부 옵션은 기본값 사용
- `source = ai`
- `status = suggested`
- `required = false`
- 캔버스에서는 보라색 점선과 `AI` 배지로 표시

**사용자 검수:**

- 채택: `status = confirmed`
- 거부: 필드 삭제
- 일괄 채택·거부 API가 있으나 현재 FRM-02에는 호출 UI가 없음

### 3.8 AI 자동 추천 프롬프트

다음 고정 프롬프트와 현재 페이지 이미지를 Gemini에 전달한다.

```text
당신은 빈 종이 양식 이미지에서 사용자가 손으로 작성할 입력 영역을 찾는 도우미입니다.
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
  각각 다른 칸에 쓰게 되어 있는 경우가 아니라면 하나의 date 필드로 합쳐서 반환하세요.
```

**응답 예시:**

```json
{
  "fields": [
    {
      "label": "성명",
      "key": "name",
      "type": "text",
      "box": { "x": 0.215, "y": 0.142, "w": 0.31, "h": 0.052 },
      "confidence": 0.96
    },
    {
      "label": "생년월일",
      "key": "date_of_birth",
      "type": "date",
      "box": { "x": 0.215, "y": 0.218, "w": 0.31, "h": 0.052 },
      "confidence": 0.91
    }
  ]
}
```

---

## 4. OCR 실행

### 4.1 문서 상태 흐름

`printed → received → processing → review_required → confirmed`

- OCR 실패: `processing → error`
- OCR 재시도: `error → processing`
- 확정 후 재검수 API는 있으나 호출 UI는 없음

### 4.2 실행 조건

- 요청: `POST /api/documents/{documentId}/process`
- 허용 시작 상태: `received` 또는 `error`
- 실행 시 문서 상태를 `processing`으로 변경
- 문서의 필드와 선택 옵션을 조회
- 현재 구현은 첫 번째 페이지 이미지 1장만 OCR에 사용

> **확인 필요**: 다중 페이지 문서의 2페이지 이후 이미지는 현재 OCR 대상이 아니다.

### 4.3 AI 미호출 처리

다음 조건에서는 Gemini를 호출하지 않는다.

- `GEMINI_API_KEY` 없음
- 문서 이미지 없음

이 경우:

- 모든 필드를 수동 검수 대상으로 생성
- `reviewStatus = needs_review`
- `reviewReasons = [manual_review_requested]`
- 문서 상태는 `review_required`로 전환

### 4.4 OCR 요청 필드

필드별로 다음 정보를 프롬프트에 전달한다.

- 데이터 키
- 라벨
- 필드 유형
- 0~1 정규화 영역
- 유형별 인식 설정
- 선택 필드의 옵션 표시명과 저장값

- 영역 좌표는 이미지를 실제로 잘라 보내는 값이 아니라 프롬프트 위치 힌트
- 값이 해당 영역에 없으면 다른 영역의 값을 대신 사용하지 않도록 지시

### 4.5 OCR 응답

필드별 반환값:

| 값 | 설명 |
|---|---|
| `dataKey` | 요청에 포함된 데이터 키 |
| `rawValue` | AI가 읽은 원문 또는 null |
| `confidence` | 0~1 신뢰도 |

- AI는 `finalValue`를 직접 반환하지 않음
- 서버에서 정규화·검증 후 최종값 계산
- 요청 목록에 없는 데이터 키는 사용하지 않도록 지시

### 4.6 필기 OCR 프롬프트 구성

필기 OCR 프롬프트는 고정 안내문과 양식별 필드 목록을 조합해 생성한다. 필드 목록에는 FRM-02에서 저장한 인식 설정 중 실제 OCR 판단에 필요한 값만 포함한다.

```text
이미지는 사용자가 손으로 작성한 문서 페이지입니다. 아래 필드 목록 각각에 대해
해당 위치에 손으로 적힌 값을 읽어 JSON으로 반환하세요.

각 필드의 region은 이미지 전체를 기준으로 한 정규화 좌표입니다 — x/y는 좌상단 기준
0~1 비율(왼쪽 위 모서리), w/h는 그 위치에서부터의 너비·높이 비율입니다. 예를 들어
x:0.2, y:0.3, w:0.3, h:0.05는 이미지 가로의 20~50%, 세로의 30~35% 사각형 영역을
뜻합니다. 라벨 텍스트만으로 이미지 전체를 훑지 말고, 이 region이 가리키는 위치와
그 주변에 실제로 적힌 손글씨를 우선적으로 읽으세요 — 값이 region 안에 없다면 그 필드는
null로 두고, 다른 필드의 값을 대신 넣지 마세요.

각 필드의 config는 편집기에서 사용자가 직접 설정한 판정 규칙입니다 — 아래 공통 규칙보다
config를 항상 우선하세요. config가 없는 필드에만 아래 공통 규칙을 적용하세요.

{필드별 안내 문구}

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
- 이미지에 없는 필드는 만들지 말고, 목록에 있는 dataKey만 그대로 사용하세요.
```

> 실제 요청에서는 `{필드별 안내 문구}` 위치에 양식의 필드 정보가 동적으로 삽입된다.

### 4.7 필드별 안내 문구 생성 규칙

기본 형식:

```text
- dataKey="{데이터 키}" label="{라벨}" type={유형} region=(x:{x}, y:{y}, w:{w}, h:{h}) options=[{저장값(표시명)}] config={{인식 설정}}
```

- `region`: 좌표를 소수점 셋째 자리까지 표시
- `options`: 선택 필드에만 표시
- `config`: 해당 유형에서 프롬프트에 반영할 설정이 있을 때만 표시
- 필드 순서는 저장된 양식 필드 순서를 따름

예시:

```text
- dataKey="applicant_name" label="신청인 성명" type=text region=(x:0.183, y:0.124, w:0.352, h:0.048) config={허용 문자=alnum, 최대길이=20}
- dataKey="visit_type" label="방문 유형" type=choice region=(x:0.183, y:0.418, w:0.352, h:0.072) options=[meeting(회의), lecture(강의), interview(인터뷰)] config={단일 선택만 가능}
```

### 4.8 유형별 설정 적용 예시

#### 텍스트

**저장 설정:**

```json
{
  "writingMode": "multiline",
  "language": "ko",
  "charPolicy": "alnum",
  "maxLength": 20,
  "preserveNewline": true,
  "preserveWhitespace": true
}
```

**프롬프트 반영:**

```text
config={허용 문자=alnum, 최대길이=20, 여러 줄 입력 가능, 줄바꿈 그대로 보존, 공백 그대로 보존}
```

- `language`는 현재 프롬프트에 반영되지 않음
- `charPolicy = all`이면 허용 문자 안내를 생략
- `maxLength`는 OCR 안내와 후처리 길이 검증에 사용

#### 숫자

**저장 설정:**

```json
{
  "numberFormat": "decimal",
  "decimalPlaces": 2,
  "allowNegative": true,
  "min": -100,
  "max": 100,
  "unit": "kg",
  "thousandsSeparator": true,
  "allowBlank": false
}
```

**프롬프트 반영:**

```text
config={형식=decimal, 소수 자리수=2, 음수 허용, 최소=-100, 최대=100, 단위=kg}
```

- `thousandsSeparator`, `allowBlank`는 현재 프롬프트에 반영되지 않음
- `decimalPlaces = 0`은 현재 조건상 프롬프트 문구에서 생략됨
- AI가 반환한 쉼표와 공백은 서버에서 제거한 뒤 숫자로 변환

#### 날짜

**저장 설정:**

```json
{
  "inputFormat": "YYYY년 MM월 DD일",
  "outputFormat": "YYYY-MM-DD"
}
```

**프롬프트 반영:**

```text
config={입력형식=YYYY년 MM월 DD일}
```

- `inputFormat = auto`이면 입력 형식 안내를 생략
- `outputFormat`은 프롬프트가 아닌 서버 후처리에 사용
- 예: AI 원문 `2026년 8월 28일` → 최종값 `2026-08-28`

#### 시간

**저장 설정:**

```json
{
  "inputMode": "12h",
  "outputFormat": "HH:mm"
}
```

**프롬프트 반영:**

```text
config={입력형식=12h}
```

- `inputMode = auto`이면 입력 형식 안내를 생략
- `outputFormat`은 서버 후처리에 사용
- 예: AI 원문 `오후 2시 30분` → 최종값 `14:30`

#### 체크 — boolean 출력

**저장 설정:**

```json
{
  "mode": "symbol_classification",
  "trueMarks": ["✓", "V", "●"],
  "falseMarks": ["X"],
  "blankValue": "false",
  "outputMode": "boolean"
}
```

**프롬프트 반영:**

```text
config={판정모드=symbol_classification, true로 볼 표시=[✓, V, ●], false로 볼 표시=[X], 빈칸 처리=false}
```

- `✓`, `V`, `●`는 `true`, `X`는 `false`로 반환
- 빈칸 처리 설정은 프롬프트에는 전달되지만 현재 후처리 분기는 미구현

#### 체크 — 필기 기호 그대로 출력

**저장 설정:**

```json
{
  "mode": "symbol_classification",
  "trueMarks": ["V", "O"],
  "falseMarks": ["X"],
  "blankValue": "null",
  "outputMode": "symbol"
}
```

**프롬프트 반영:**

```text
config={판정모드=symbol_classification, true로 볼 표시=[V, O], false로 볼 표시=[X], 빈칸 처리=null,
출력형식=true/false로 바꾸지 말고 실제로 그려진 기호를 위 표시 목록 중 하나로 그대로 rawValue에 반환
(예: "V" 또는 "X"), 아무 표시도 없으면 null}
```

- AI는 boolean 대신 이미지에서 읽은 실제 기호를 `rawValue`로 반환
- 서버는 허용된 true·false 기호인지 확인하고 해당 기호를 최종값으로 유지

#### 선택

**저장 설정 및 옵션:**

```json
{
  "mode": "multiple",
  "conflictPolicy": "review_required",
  "csvPolicy": "delimiter",
  "options": [
    { "value": "meeting", "label": "회의" },
    { "value": "lecture", "label": "강의" },
    { "value": "interview", "label": "인터뷰" }
  ]
}
```

**프롬프트 반영:**

```text
options=[meeting(회의), lecture(강의), interview(인터뷰)] config={복수 선택 가능}
```

- AI는 표시명 대신 저장값을 반환
- 회의와 인터뷰가 선택된 경우: `meeting,interview`
- `conflictPolicy`는 단일 선택 결과가 여러 개일 때 서버 검증에 사용
- `csvPolicy`는 OCR 프롬프트가 아닌 Excel 출력에 사용

### 4.9 필기 OCR 완성 예시

**생성된 필드 목록:**

```text
- dataKey="applicant_name" label="신청인 성명" type=text region=(x:0.183, y:0.124, w:0.352, h:0.048) config={최대길이=20}
- dataKey="date_of_birth" label="생년월일" type=date region=(x:0.183, y:0.201, w:0.352, h:0.048) config={입력형식=YYYY년 MM월 DD일}
- dataKey="consent" label="개인정보 수집 동의" type=check region=(x:0.183, y:0.302, w:0.052, h:0.052) config={판정모드=symbol_classification, true로 볼 표시=[V, O], false로 볼 표시=[X], 빈칸 처리=null, 출력형식=true/false로 바꾸지 말고 실제로 그려진 기호를 위 표시 목록 중 하나로 그대로 rawValue에 반환(예: "V" 또는 "X"), 아무 표시도 없으면 null}
- dataKey="visit_type" label="방문 유형" type=choice region=(x:0.183, y:0.418, w:0.352, h:0.072) options=[meeting(회의), lecture(강의), interview(인터뷰)] config={복수 선택 가능}
```

**AI 응답 예시:**

```json
{
  "values": [
    { "dataKey": "applicant_name", "rawValue": "홍길동", "confidence": 0.97 },
    { "dataKey": "date_of_birth", "rawValue": "1990년 3월 12일", "confidence": 0.93 },
    { "dataKey": "consent", "rawValue": "V", "confidence": 0.91 },
    { "dataKey": "visit_type", "rawValue": "meeting,interview", "confidence": 0.88 }
  ]
}
```

**서버 후처리 결과:**

| 데이터 키 | AI 원문 | 최종값 |
|---|---|---|
| `applicant_name` | 홍길동 | 홍길동 |
| `date_of_birth` | 1990년 3월 12일 | 1990-03-12 |
| `consent` | V | V |
| `visit_type` | meeting,interview | meeting,interview |

---

## 5. 필드 설정과 OCR 반영

| 유형 | 프롬프트에 반영 | 정규화·검증에 반영 |
|---|---|---|
| 텍스트 | 여러 줄, 문자 정책, 최대 길이, 공백·줄바꿈 보존 | 최대 길이 검증 |
| 숫자 | 정수/소수, 소수 자릿수, 음수, 최소·최대, 단위 | 숫자 변환, 최소·최대 범위 검증 |
| 날짜 | 입력 형식 힌트 | 출력 형식에 따라 원문 또는 `YYYY-MM-DD` |
| 시간 | 입력 형식 힌트 | 출력 형식에 따라 원문 또는 `HH:mm` |
| 체크 | 판정 방식, true·false 기호, 출력 방식, 빈칸 정책 | boolean 또는 기호 정규화 |
| 선택 | 단일·다중 선택, 옵션 목록 | 옵션 유효성 및 충돌 정책 검증 |

### 5.1 현재 반영되지 않는 설정

- 텍스트 인식 언어: 프롬프트·정규화에 미반영
- 숫자 빈칸 허용: 별도 분기 없음
- 숫자 천 단위 구분 허용: 설정과 관계없이 콤마·공백 제거
- 체크 빈칸 처리: 정규화·검증 분기 미구현
- 선택 CSV 정책: OCR이 아닌 내보내기에서만 사용

### 5.2 선택 필드

- 프롬프트 옵션 형식: `{storedValue}({label})`
- AI는 라벨이 아니라 `storedValue` 반환
- 정의되지 않은 값은 `unknown_choice`
- 단일 선택에서 값이 여러 개면 충돌 정책 적용
  - `first_marked`: 첫 값 사용
  - `last_marked`: 마지막 값 사용
  - `review_required`: 원값 유지 후 검수 필요 처리

---

## 6. 후처리·저장

### 6.1 처리 순서

1. AI의 `rawValue` 수신
2. 필드 유형별 값 정규화
3. 필수값·형식·범위·선택 옵션 검증
4. 검수 사유 생성
5. `FieldValue` 저장
6. 문서 상태를 `review_required`로 변경

### 6.2 저장값

| 필드 | 저장 내용 |
|---|---|
| `rawOcrValue` | AI가 반환한 원문 |
| `normalizedValue` | 유형별 정규화 결과 |
| `finalValue` | 현재 정규화 결과와 동일한 초기 확정 후보값 |
| `valueSource` | 값의 출처. 규칙은 아래 6.2.1 참고 |
| `confidence` | AI 신뢰도 |
| `reviewStatus` | confirmed / needs_review |
| `reviewReasons` | 검수 필요 사유 배열 |
| `model` | 사용한 AI 모델 |
| `promptVersion` | 프롬프트 버전 |

#### 6.2.1 `valueSource` 저장 규칙

- Gemini 응답(`values` 배열)에 해당 `dataKey`가 존재하면 `valueSource = "ai"`
- 응답에 해당 `dataKey`가 아예 없으면 `valueSource = null`
- `rawValue`가 `null`이어도, 응답에 그 필드의 항목 자체가 있었다면 `valueSource`는 `"ai"`로 저장된다 (AI가 "찾지 못했다"고 답한 것과 AI가 그 필드를 아예 처리하지 않은 것을 구분하기 위함)
- 4.3의 "AI 미호출" 경로(API 키 없음·이미지 없음)에서 생성되는 `FieldValue`는 `valueSource = null`

### 6.3 검수 사유

- `required_missing`: 필수값 누락
- `type_mismatch`: 유형 또는 길이 오류
- `number_out_of_range`: 숫자 범위 초과
- `invalid_date`: 날짜 형식 오류
- `invalid_time`: 시간 형식 오류
- `unknown_choice`: 정의되지 않은 선택값
- `choice_conflict`: 단일 선택 충돌
- `manual_review_requested`: AI 미실행으로 수동 확인 필요

### 6.4 완료·실패

- 검수 사유 없음: `reviewStatus = confirmed`
- 검수 사유 있음: `reviewStatus = needs_review`
- OCR 성공: 문서 `review_required`
- Gemini 호출 실패:
  - AI 작업 `failed`
  - 문서 `error`
  - API `502 AI_OCR_FAILED`

---

## 7. 관련 화면

- **FRM-02**: 필드 자동 추천 및 인식 옵션 설정
- **DOC-01**: OCR 대상 문서 목록
- **DOC-02**: OCR 결과 검수·수정·확정
- **FRM-03**: 확정값을 고객 Excel 서식으로 출력

---

## 8. 구현 참고

- AI 자동 추천은 현재 페이지 한 장만 분석
- 필기 OCR은 현재 첫 페이지 이미지만 처리
- AI 후보는 자동 확정하지 않으며 사용자 검수 필요
- OCR 결과 수정은 DOC-02에서 수행
- 확정 후 재검수 API는 존재하지만 연결된 화면 없음
