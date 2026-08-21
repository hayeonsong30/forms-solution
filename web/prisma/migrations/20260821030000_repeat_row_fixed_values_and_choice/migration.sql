-- 반복행: 행별 고정값
ALTER TABLE "repeat_groups" ADD COLUMN "fixed_rows" JSONB;

-- choice_options: field_id를 옵셔널로, repeat_column_id 추가 (반복행 컬럼에도 옵션 부착 가능)
ALTER TABLE "choice_options" ALTER COLUMN "field_id" DROP NOT NULL;
ALTER TABLE "choice_options" ADD COLUMN "repeat_column_id" TEXT;
ALTER TABLE "choice_options" ADD CONSTRAINT "choice_options_repeat_column_id_fkey"
  FOREIGN KEY ("repeat_column_id") REFERENCES "repeat_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
