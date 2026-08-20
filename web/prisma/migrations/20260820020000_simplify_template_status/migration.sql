-- 사용자 피드백: draft/active + 별도 printable 불리언 두 축 모델이 혼란스럽다 → 단일 status로 재설계.
-- 기존 데이터 규칙: printable=true였던 행 -> printable, 그 외(draft 또는 active+printable=false) -> draft.

-- 1) 새 enum 타입 생성
CREATE TYPE "TemplateStatus_new" AS ENUM ('draft', 'printable');

-- 2) 임시 컬럼에 매핑된 값 채우기
ALTER TABLE "templates" ADD COLUMN "status_new" "TemplateStatus_new";
UPDATE "templates"
SET "status_new" = CASE WHEN "printable" = true THEN 'printable'::"TemplateStatus_new" ELSE 'draft'::"TemplateStatus_new" END;
ALTER TABLE "templates" ALTER COLUMN "status_new" SET NOT NULL;
ALTER TABLE "templates" ALTER COLUMN "status_new" SET DEFAULT 'draft';

-- 3) 기존 컬럼 제거, 새 컬럼으로 교체
ALTER TABLE "templates" DROP COLUMN "status";
ALTER TABLE "templates" DROP COLUMN "printable";
ALTER TABLE "templates" RENAME COLUMN "status_new" TO "status";

-- 4) 옛 enum 타입 정리
DROP TYPE "TemplateStatus";
ALTER TYPE "TemplateStatus_new" RENAME TO "TemplateStatus";
