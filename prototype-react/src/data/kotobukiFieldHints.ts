import type { FieldType } from '../types'

export interface OptionRegionHint {
  option: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
}

export interface FieldMeta {
  id: string
  label: string
  type: FieldType
  variant?: string
  excelColumn: string
  options?: string[]
  // single-choice/multiple-choice에서만 사용 — 옵션(체크박스/라디오)별 실제 좌표.
  // PRD §7.7.3: 체크·라디오는 펜 획 좌표 규칙을 우선하므로 옵션 전체를 감싸는 큰 박스가 아니라
  // 옵션마다 실제 사각형 위치가 있어야 한다.
  optionRegions?: OptionRegionHint[]
  // 페이지 대비 % 좌표 — 렌더링된 캔버스 크기에 곱해서 실제 px로 변환
  xPct: number
  yPct: number
  wPct: number
  hPct: number
}

// 고토부키 施設利用申込書(Facility Booking Form) 샘플 — 실제 PDF를 150dpi로 래스터화한 뒤
// 픽셀 단위로 표·체크박스 경계를 측정해 만든 좌표(눈대중 추정이 아님). 라디오/체크박스는
// 옵션 전체를 감싸는 하나의 큰 박스 대신 옵션(네모 칸)마다 실제 좌표를 갖는다.
export const kotobukiFieldHints: FieldMeta[] = [
  { id: 'F.NAME', label: '氏名 / NAME', type: 'shorttext', excelColumn: 'name', xPct: 19.42, yPct: 13.68, wPct: 40.13, hPct: 5.08 },
  {
    id: 'F.GENDER',
    label: '性別 / GENDER',
    type: 'single-choice',
    variant: 'Radio',
    excelColumn: 'gender',
    options: ['男性', '女性', 'ノンバイナリ'],
    xPct: 59.55,
    yPct: 13.68,
    wPct: 32.35,
    hPct: 5.08,
    optionRegions: [
      { option: '男性', xPct: 67.12, yPct: 15.56, wPct: 1.69, hPct: 1.2 },
      { option: '女性', xPct: 74.62, yPct: 15.56, wPct: 1.69, hPct: 1.2 },
      { option: 'ノンバイナリ', xPct: 82.11, yPct: 15.56, wPct: 1.77, hPct: 1.2 },
    ],
  },
  { id: 'F.BIRTHDATE', label: '生年月日 / DATE OF BIRTH', type: 'date', variant: 'YYYY/MM/DD', excelColumn: 'birth_date', xPct: 19.42, yPct: 18.76, wPct: 36.18, hPct: 4.05 },
  { id: 'F.PHONE', label: '電話番号 / PHONE', type: 'shorttext', excelColumn: 'phone', xPct: 65.67, yPct: 18.76, wPct: 26.23, hPct: 4.05 },
  { id: 'F.ADDRESS', label: '住所 / ADDRESS', type: 'shorttext', excelColumn: 'address', xPct: 19.42, yPct: 22.81, wPct: 72.48, hPct: 4.1 },
  { id: 'F.ORG', label: '会社・団体名 / ORGANIZATION', type: 'shorttext', excelColumn: 'organization', xPct: 19.42, yPct: 26.91, wPct: 36.18, hPct: 4.05 },
  { id: 'F.EMAIL', label: 'メールアドレス / E-MAIL', type: 'shorttext', excelColumn: 'email', xPct: 65.67, yPct: 26.91, wPct: 26.23, hPct: 4.05 },
  {
    id: 'F.APPLY_TYPE',
    label: '申込区分 / TYPE',
    type: 'single-choice',
    variant: 'Radio',
    excelColumn: 'apply_type',
    options: ['新規', '追加', '変更', '取消'],
    xPct: 19.42,
    yPct: 35.52,
    wPct: 72.48,
    hPct: 4.16,
    optionRegions: [
      { option: '新規', xPct: 22.32, yPct: 36.94, wPct: 1.69, hPct: 1.2 },
      { option: '追加', xPct: 35.13, yPct: 36.94, wPct: 1.69, hPct: 1.2 },
      { option: '変更', xPct: 47.95, yPct: 36.94, wPct: 1.69, hPct: 1.2 },
      { option: '取消', xPct: 60.76, yPct: 36.94, wPct: 1.69, hPct: 1.2 },
    ],
  },
  { id: 'F.USE_DATE', label: '利用日 / DATE', type: 'date', variant: 'YYYY/MM/DD', excelColumn: 'use_date', xPct: 19.42, yPct: 39.68, wPct: 30.14, hPct: 4.16 },
  { id: 'F.USE_TIME', label: '利用時間 / TIME', type: 'time', variant: '24 Hour', excelColumn: 'use_time', xPct: 58.18, yPct: 39.68, wPct: 33.72, hPct: 4.16 },
  {
    id: 'F.FACILITY',
    label: '利用施設 / FACILITY',
    type: 'single-choice',
    variant: 'Boxes',
    excelColumn: 'facility',
    options: ['会議室', '研修室', '多目的室', '展示スペース'],
    xPct: 19.42,
    yPct: 43.84,
    wPct: 72.48,
    hPct: 4.16,
    optionRegions: [
      { option: '会議室', xPct: 22.32, yPct: 45.27, wPct: 1.69, hPct: 1.2 },
      { option: '研修室', xPct: 39.81, yPct: 45.27, wPct: 1.69, hPct: 1.2 },
      { option: '多目的室', xPct: 57.53, yPct: 45.27, wPct: 1.77, hPct: 1.2 },
      { option: '展示スペース', xPct: 78.32, yPct: 45.27, wPct: 1.69, hPct: 1.2 },
    ],
  },
  {
    id: 'F.PURPOSE',
    label: '利用目的 / PURPOSE',
    type: 'single-choice',
    variant: 'Radio',
    excelColumn: 'purpose',
    options: ['会議・打合せ', '研修・講習', '展示・イベント', '地域活動', 'その他'],
    xPct: 19.42,
    yPct: 48.0,
    wPct: 72.48,
    hPct: 4.17,
    optionRegions: [
      { option: '会議・打合せ', xPct: 22.32, yPct: 49.43, wPct: 1.69, hPct: 1.2 },
      { option: '研修・講習', xPct: 36.34, yPct: 49.43, wPct: 1.69, hPct: 1.2 },
      { option: '展示・イベント', xPct: 50.36, yPct: 49.43, wPct: 1.69, hPct: 1.2 },
      { option: '地域活動', xPct: 65.91, yPct: 49.43, wPct: 1.69, hPct: 1.2 },
      { option: 'その他', xPct: 81.87, yPct: 49.43, wPct: 1.77, hPct: 1.2 },
    ],
  },
  { id: 'F.USERS', label: '利用人数 / No. OF USERS', type: 'number', variant: 'Number', excelColumn: 'user_count', xPct: 19.42, yPct: 52.17, wPct: 21.84, hPct: 4.16 },
  {
    id: 'F.CONTACT',
    label: 'ご希望の連絡方法 / PREFERRED CONTACT METHOD',
    type: 'multiple-choice',
    variant: 'Checkboxes',
    excelColumn: 'contact_method',
    options: ['電話', 'メール'],
    xPct: 62.13,
    yPct: 52.17,
    wPct: 29.77,
    hPct: 4.16,
    optionRegions: [
      { option: '電話', xPct: 68.17, yPct: 53.59, wPct: 1.69, hPct: 1.25 },
      { option: 'メール', xPct: 78.0, yPct: 53.59, wPct: 1.69, hPct: 1.25 },
    ],
  },
  { id: 'F.DETAILS', label: '利用内容 / DETAILS', type: 'longtext', excelColumn: 'details', xPct: 19.42, yPct: 60.89, wPct: 72.48, hPct: 9.92 },
  {
    id: 'F.EQUIPMENT',
    label: '希望設備 / EQUIPMENT',
    type: 'multiple-choice',
    variant: 'Checkboxes',
    excelColumn: 'equipment',
    options: ['プロジェクター', 'スクリーン', 'マイク', 'ホワイトボード', '延長コード', 'HDMIケーブル', 'その他'],
    xPct: 19.42,
    yPct: 70.81,
    wPct: 72.48,
    hPct: 6.9,
    optionRegions: [
      { option: 'プロジェクター', xPct: 22.32, yPct: 72.29, wPct: 1.69, hPct: 1.2 },
      { option: 'スクリーン', xPct: 41.98, yPct: 72.29, wPct: 1.69, hPct: 1.2 },
      { option: 'マイク', xPct: 59.63, yPct: 72.29, wPct: 1.69, hPct: 1.2 },
      { option: 'ホワイトボード', xPct: 76.79, yPct: 72.29, wPct: 1.69, hPct: 1.2 },
      { option: '延長コード', xPct: 22.32, yPct: 75.09, wPct: 1.69, hPct: 1.2 },
      { option: 'HDMIケーブル', xPct: 40.45, yPct: 75.09, wPct: 1.69, hPct: 1.2 },
      { option: 'その他', xPct: 59.63, yPct: 75.09, wPct: 1.69, hPct: 1.2 },
    ],
  },
  {
    id: 'F.AGREEMENT',
    label: '確認事項 / REVIEW & SIGNATURE',
    type: 'multiple-choice',
    variant: 'Checkboxes',
    excelColumn: 'agreement',
    options: ['記載内容に相違ありません', '施設利用規約に同意します', '個人情報の取扱いに同意します'],
    xPct: 7.45,
    yPct: 82.27,
    wPct: 84.45,
    hPct: 4.56,
    optionRegions: [
      { option: '記載内容に相違ありません', xPct: 9.91, yPct: 83.92, wPct: 1.69, hPct: 1.2 },
      { option: '施設利用規約に同意します', xPct: 37.79, yPct: 83.92, wPct: 1.69, hPct: 1.2 },
      { option: '個人情報の取扱いに同意します', xPct: 65.67, yPct: 83.92, wPct: 1.69, hPct: 1.2 },
    ],
  },
  { id: 'F.SIGNATURE', label: '申込者署名 / SIGNATURE', type: 'signature', excelColumn: 'signature', xPct: 19.42, yPct: 86.83, wPct: 33.76, hPct: 5.19 },
  { id: 'F.FILLDATE', label: '記入日 / DATE', type: 'date', variant: 'YYYY/MM/DD', excelColumn: 'fill_date', xPct: 62.93, yPct: 86.83, wPct: 28.97, hPct: 5.19 },
]
