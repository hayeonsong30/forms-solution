# 폼솔루션 반복행 기능 구현 요청

## 1. 문서 목적

폼솔루션 편집기에 반복행 정의, 스마트펜 데이터 판정, OCR, JSON·CSV 변환 기능을 구현한다.

구현 대상 양식은 다음 두 가지다.

1. 설비점검표: `良 / 否 / 備考`가 반복되는 5개 점검행
2. ITSUWA 점검표: 시간·포장형태·점검자·체크 항목·비고가 반복되는 25개 행

반복행은 필드를 여러 번 수동 복사하는 기능이 아니다. 사용자가 첫 번째 행을 기준행으로 지정하고 기준행 내부에 필드를 배치하면, 시스템이 동일한 구조를 아래 행에 자동으로 복제해야 한다.

```text
반복행 그룹 영역
├─ 기준행: 01번 행
├─ 반복 방향: 아래
├─ 행 높이
├─ 반복 횟수
└─ 기준행 내부 필드
```

---

## 2. 좌표 및 복제 원칙

각 필드는 기준행 안에서의 상대 좌표로 저장한다.

```ts
relativeX = field.x - repeatGroup.x;
relativeY = field.y - baseRow.y;

copiedField.x = repeatGroup.x + relativeX;
copiedField.y = baseRow.y + rowHeight * rowIndex + relativeY;
```

PDF 좌표는 페이지 크기를 기준으로 정규화해서 저장한다.

```ts
type NormalizedRect = {
  x: number;      // 0~1
  y: number;      // 0~1
  width: number;  // 0~1
  height: number; // 0~1
};
```

자동 생성된 5개 또는 25개의 필드를 템플릿에 각각 저장하지 않는다. 다음 정보만 저장하고 화면 표시와 데이터 추출 시 파생 필드를 계산한다.

- 반복행 전체 영역
- 기준행 영역
- 기준행 내부 필드의 상대 좌표
- 반복 방향
- 행 높이 및 행 간격
- 반복 횟수
- 행별 고정값

---

## 3. 사용자 작업 흐름

1. 문서에서 반복되는 표의 전체 데이터 영역을 선택한다.
2. `반복행으로 묶기`를 실행한다.
3. 첫 번째 행을 기준행으로 지정한다.
4. 행 높이와 반복 횟수를 설정한다.
5. 기준행 안에 필드 영역을 지정한다.
6. 자동 복제된 필드를 미리보기로 확인한다.
7. 반복행을 저장한다.

표 제목과 컬럼 헤더는 반복행 영역에서 제외한다.

```text
[점검 항목 제목]      ← 제외
[컬럼명 헤더]         ← 제외
[01번 데이터 행]      ← 기준행
[02번 데이터 행]      ← 자동 복제
[03번 데이터 행]      ← 자동 복제
```

### 3.1 편집 화면 표시

- 반복행 전체: 보라색 점선
- 기준행: 주황색 테두리
- 텍스트·숫자·시간 필드: 파란색
- 체크·선택 필드: 초록색
- 고정값: 회색 또는 영역 표시 없음

### 3.2 오른쪽 속성 패널

```text
반복행 이름
데이터 키
기준행 위치
행 높이
반복 방향
반복 횟수
빈 행 출력 여부
```

예시:

```text
반복행 이름: 점검 항목
데이터 키: inspection_items
기준행: 1행
행 높이: 58px
반복 방향: 아래
반복 횟수: 5
빈 행 출력: 제외
```

### 3.3 행 높이 설정

다음 방법을 지원한다.

1. 기준행 상단선과 하단선을 직접 드래그
2. `Top / Left / Width / Height` 숫자 입력
3. 기준행 영역을 기준으로 행 높이 자동 계산

1차 구현에서는 모든 행의 높이가 동일한 표만 지원한다. 높이가 다른 행을 개별 조정하는 기능은 제외한다.

---

## 4. 사례 1: 설비점검표

### 4.1 표 구조

```text
No. | 점검 내용 | 良 | 否 | 備考
01  | 외관 점검 | □  | □  |
02  | 전원 점검 | □  | □  |
...
05  | 청소 점검 | □  | □  |
```

```json
{
  "id": "repeat_inspection_items",
  "name": "점검 항목",
  "dataKey": "inspection_items",
  "direction": "vertical",
  "rowCount": 5,
  "baseRowIndex": 0,
  "skipEmptyRows": true
}
```

### 4.2 고정값 처리

`No.`와 `점검 내용`은 PDF에 인쇄된 값이므로 OCR 필드로 만들지 않는다. 템플릿 메타데이터에 행별 고정값으로 저장한다.

```json
[
  {
    "item_no": "01",
    "item_name": "外観に破損・汚れがない"
  },
  {
    "item_no": "02",
    "item_name": "電源・配線に異常がない"
  }
]
```

### 4.3 `良 / 否` 판정

두 개의 체크박스처럼 보이지만 데이터 의미는 하나의 단일 선택 필드다.

```json
{
  "id": "field_result",
  "name": "판정",
  "dataKey": "result",
  "type": "single_selection",
  "options": [
    {
      "label": "良",
      "value": "good",
      "rect": {}
    },
    {
      "label": "否",
      "value": "bad",
      "rect": {}
    }
  ]
}
```

- `良` 영역에 스트로크 존재: `result = "good"`
- `否` 영역에 스트로크 존재: `result = "bad"`
- 두 영역 모두 선택: 자동 확정하지 않고 검수 대상
- 두 영역 모두 비어 있고 비고도 없음: 빈 행
- 판정은 비어 있고 비고만 있음: 판정 누락 검수 대상

```json
{
  "result": null,
  "reviewRequired": true,
  "reviewReason": "MULTIPLE_SELECTION"
}
```

### 4.4 비고

비고 셀 내부를 하나의 텍스트 OCR 영역으로 지정한다.

```json
{
  "id": "field_note",
  "name": "비고",
  "dataKey": "note",
  "type": "text",
  "ocrEnabled": true
}
```

### 4.5 출력 예시

```json
{
  "inspection_items": [
    {
      "item_no": "01",
      "item_name": "外観に破損・汚れがない",
      "result": "good",
      "note": ""
    },
    {
      "item_no": "02",
      "item_name": "電源・配線に異常がない",
      "result": "bad",
      "note": "ケーブル交換必要"
    }
  ]
}
```

```csv
점검번호,점검내용,판정,비고
01,外観に破損・汚れがない,good,
02,電源・配線に異常がない,bad,ケーブル交換必要
```

---

## 5. 사례 2: ITSUWA 반복행

### 5.1 표 구조

```text
Lot No.
시간
포장형태
점검자
이물
오염/파손
하중
IJP
인자
카드
비고
```

01번 행을 기준행으로 지정하고 동일한 구조를 25번 행까지 복제한다.

```json
{
  "id": "repeat_inspection_rows",
  "name": "ITSUWA 점검행",
  "dataKey": "inspection_rows",
  "direction": "vertical",
  "rowCount": 25,
  "baseRowIndex": 0,
  "skipEmptyRows": true
}
```

### 5.2 기준행 내부 필드

```json
[
  { "name": "시간", "dataKey": "time", "type": "time", "ocrEnabled": true },
  { "name": "포장형태", "dataKey": "package_type", "type": "text", "ocrEnabled": true },
  { "name": "점검자", "dataKey": "inspector", "type": "text", "ocrEnabled": true },
  { "name": "이물", "dataKey": "foreign_object", "type": "checkbox" },
  { "name": "오염/파손", "dataKey": "dirt_damage", "type": "checkbox" },
  { "name": "하중", "dataKey": "load", "type": "checkbox" },
  { "name": "IJP", "dataKey": "ijp", "type": "checkbox" },
  { "name": "인자", "dataKey": "print", "type": "checkbox" },
  { "name": "카드", "dataKey": "card", "type": "checkbox" },
  { "name": "비고", "dataKey": "note", "type": "text", "ocrEnabled": true }
]
```

### 5.3 체크 필드 처리

ITSUWA의 체크 열은 `良 / 否`처럼 하나만 선택하는 단일 선택이 아니다. 한 행에서 여러 항목이 동시에 선택될 수 있으므로 각각 독립적인 Boolean 필드로 저장한다.

```json
{
  "foreign_object": true,
  "dirt_damage": true,
  "load": false,
  "ijp": true,
  "print": true,
  "card": false
}
```

스마트펜 입력에서는 체크 영역 안에 스트로크가 있는지만 확인하며 OCR을 호출하지 않는다.

```ts
function isChecked(
  strokes: PenStroke[],
  fieldRect: NormalizedRect
): boolean {
  return strokes.some((stroke) =>
    stroke.points.some((point) => isPointInsideRect(point, fieldRect))
  );
}
```

체크 영역은 네모 도형만 정확하게 감싸지 않고 주변 필기 허용 여백까지 포함한다.

```ts
const hitPadding = 0.003;
const hitRect = expandRect(field.rect, hitPadding);
```

### 5.4 Lot No. 처리

`01~25`는 PDF에 인쇄된 고정값이므로 OCR하지 않는다.

```ts
const lotNo = String(rowIndex + 1).padStart(2, "0");
```

### 5.5 빈 행 판정

다음 값이 모두 비어 있으면 빈 행으로 처리한다.

```ts
const isEmptyRow =
  !time &&
  !packageType &&
  !inspector &&
  !foreignObject &&
  !dirtDamage &&
  !load &&
  !ijp &&
  !print &&
  !card &&
  !note;
```

빈 행은 JSON 배열과 CSV에서 제외한다. 중간에 빈 행이 있어도 뒤쪽에 작성된 행은 정상적으로 출력한다.

```text
01 작성 → 출력
02 빈 행 → 제외
03 작성 → 출력
```

### 5.6 출력 예시

```json
{
  "inspection_rows": [
    {
      "lot_no": "01",
      "time": "09:00",
      "package_type": "通常",
      "inspector": "加藤",
      "foreign_object": true,
      "dirt_damage": true,
      "load": true,
      "ijp": true,
      "print": true,
      "card": true,
      "note": ""
    }
  ]
}
```

```csv
Lot No.,시간,포장형태,점검자,이물,오염파손,하중,IJP,인자,카드,비고
01,09:00,通常,加藤,true,true,true,true,true,true,
```

---

## 6. OCR 및 스마트펜 처리

### 6.1 텍스트·시간·비고

```text
스마트펜 좌표 수집
→ 필드 영역에 포함된 스트로크 추출
→ 해당 스트로크만 이미지로 렌더링
→ Gemini OCR 호출
→ 필드 유형에 맞게 값 정규화
```

### 6.2 체크·단일 선택

```text
스마트펜 좌표 수집
→ 선택 영역 안에 스트로크가 있는지 확인
→ true/false 또는 선택값으로 변환
```

스마트펜 좌표가 있는 체크 영역에는 Gemini OCR을 호출하지 않는다. 이미지 파일만 업로드하는 테스트에서는 체크 영역의 잉크 존재 여부를 이미지 분석으로 판단한다.

---

## 7. 데이터 모델

```ts
type RepeatGroup = {
  id: string;
  name: string;
  dataKey: string;
  pageIndex: number;

  groupRect: NormalizedRect;
  baseRowRect: NormalizedRect;

  direction: "vertical";
  rowCount: number;
  rowGap: number;
  skipEmptyRows: boolean;

  fields: RepeatField[];
  fixedRows?: FixedRowValue[];
};

type RepeatField = {
  id: string;
  name: string;
  dataKey: string;

  type:
    | "text"
    | "number"
    | "date"
    | "time"
    | "checkbox"
    | "single_selection";

  relativeRect: NormalizedRect;
  ocrEnabled: boolean;
  options?: SelectionOption[];
};

type SelectionOption = {
  id: string;
  label: string;
  value: string;
  relativeRect: NormalizedRect;
};

type FixedRowValue = {
  rowIndex: number;
  values: Record<string, string | number>;
};
```

---

## 8. 편집 기능

반복행 선택 시 다음 기능을 제공한다.

- 반복행 이름 변경
- 데이터 키 변경
- 반복행 전체 영역 수정
- 기준행 높이 수정
- 반복 횟수 수정
- 기준행 내부 필드 추가·수정·삭제
- 선택 옵션별 영역 수정
- 반복 결과 미리보기
- 반복행 해제
- 전체 반복행 삭제

기준행 내부 필드를 수정하면 모든 복제행에 즉시 반영해야 한다.

```text
01행의 time 영역 너비 수정
→ 02~25행의 time 영역도 동일하게 수정
```

복제행을 개별적으로 수정하는 기능은 1차 구현에서 제외한다.

---

## 9. 데이터 테스트 화면

빈 양식 테스트에서는 OCR을 실행하지 않고 다음 항목을 보여준다.

- 반복행 데이터 키
- 반복행 내부 컬럼
- JSON 예상 구조
- CSV 컬럼 순서
- 고정값 포함 여부
- 빈 행 제외 여부

ITSUWA 예시:

```text
inspection_rows[]
├─ lot_no
├─ time
├─ package_type
├─ inspector
├─ foreign_object
├─ dirt_damage
├─ load
├─ ijp
├─ print
├─ card
└─ note
```

필드 순서를 변경하면 JSON 표시 순서와 CSV 컬럼 순서에도 반영한다. 반복행 내부 필드의 순서 변경은 편집 화면에서만 가능하게 한다.

---

## 10. 저장 검증

저장 시 다음 항목을 검증한다.

- 반복행 데이터 키가 존재하는가
- 기준행 영역이 반복행 전체 영역 안에 있는가
- 행 높이가 0보다 큰가
- 반복 횟수가 2 이상인가
- 기준행 내부에 필드가 1개 이상 있는가
- 필드가 기준행 영역을 벗어나지 않는가
- 기준행 내부의 데이터 키가 중복되지 않는가
- 단일 선택 필드에 옵션 영역이 2개 이상 있는가
- 마지막 반복행이 반복행 전체 영역을 벗어나지 않는가

영역이 문서 또는 반복행 범위를 벗어나면 저장하지 않고 해당 위치를 오류 색상으로 표시한다.

---

## 11. 완료 조건

### 11.1 설비점검표

1. 01번 행을 기준행으로 지정할 수 있다.
2. 반복 횟수를 5로 설정할 수 있다.
3. `良`, `否`, `備考` 영역을 정의할 수 있다.
4. 02~05행에 필드가 자동 표시된다.
5. `良 / 否`가 하나의 단일 선택 데이터로 변환된다.
6. 중복 선택과 판정 누락이 검수 대상으로 표시된다.
7. 작성된 행만 JSON과 CSV에 출력된다.

### 11.2 ITSUWA

1. 01번 행을 기준행으로 지정할 수 있다.
2. 반복 횟수를 25로 설정할 수 있다.
3. 시간·포장형태·점검자·6개 체크·비고 필드를 정의할 수 있다.
4. 02~25행에 동일한 구조가 자동 표시된다.
5. 체크 항목이 각각 Boolean 값으로 변환된다.
6. Lot No.가 01~25 고정값으로 자동 생성된다.
7. 빈 행을 제외하고 작성된 행만 JSON과 CSV에 출력된다.
8. 기준행 필드를 수정하면 모든 반복행에 즉시 반영된다.

### 11.3 회귀 방지

기존 일반 필드의 추가·복사·삭제·드래그·크기 변경 기능이 정상적으로 동작해야 한다. 반복행은 일반 필드 복사의 확장이 아니라 별도의 그룹 객체로 구현한다.

