# 폼솔루션 (forms solution)

NCode/스마트펜 필기를 OCR로 인식해 구조화 데이터(CSV/Excel/PDF)로 변환하는 Next.js 앱.

## 실행 방법

```bash
npm install
cp .env.example .env   # 아래 필수 값 채우기
npx prisma migrate dev
npm run dev
```

`npm run build`는 `prisma generate && prisma migrate deploy && next build` 순서로 실행된다 — 배포할 때 마이그레이션이 자동으로 적용된다.

### 필수 환경변수

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | Postgres 연결 문자열 |
| `GEMINI_API_KEY` | AI OCR(Gemini) — 서버에서만 사용, 브라우저에 노출 금지 |
| `GEMINI_MODEL` | 사용할 Gemini 모델명 |
| `NEXT_PUBLIC_DEMO_MODE` | `true`면 문서 상태와 무관하게 OCR 재실행 버튼 노출(데모용) |

`.env.example`의 `REDIS_URL`/`STORAGE_*`/`JWT_SECRET`/`NEXTAUTH_URL`은 아직 쓰이지 않는 항목(향후 단계용 플레이스홀더)이라 안 채워도 된다.

## 폴더 구조

```
src/app/
  api/                요청 처리(라우트 핸들러) — 화면과 1:1은 아니고 기능 단위
    templates/         양식 CRUD, 필드/반복그룹, 인쇄, 복제
    documents/         문서 조회/상세, OCR 실행, 확정, zip 다운로드
    exports/           CSV/Excel 내보내기
  editor/[templateId]/ 양식 편집기 화면
  templates/           양식 관리 목록
  documents/           문서 조회 목록·상세
  dashboard/           대시보드
  simple/              1차 오픈 축소 버전(디지독스 대응 범위)

src/lib/
  prisma.ts            DB 클라이언트
  ncode.ts             SOBP(패턴주소) 표시값 생성 — 실제 숫자 할당 전까지 임시
  confirmedJson.ts      확정 데이터 → CSV/Excel 변환 공통 로직
  ai/                  OCR·AI 파이프라인
  language.tsx         ko/ja i18n

prisma/
  schema.prisma        데이터 모델
  migrations/           마이그레이션 이력(배포 시 자동 적용)
```

## 참고

- 정책·화면 상세는 `PRD_폼솔루션_v0.1.md`, `PRD_폼솔루션_SOBP인쇄_상세_v1.0.md`(레포 밖, 별도 전달 예정)를 참고.
- 이 레포는 `web/` 앱 코드만 추적한다. 기획 문서·프로토타입·샘플 PDF는 포함하지 않는다.
