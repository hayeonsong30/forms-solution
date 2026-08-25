-- 사용자 정정(2026-08-25): "SOBP 공유" 개념은 이 설정의 범위가 아니었음.
-- sobp_share_count/shared_ncode(공유 SOBP)와 documents.scan_page_no(공유 SOBP 스캔의
-- 페이지 구분)를 제거하고, 단순 "이 양식으로 몇 매를 인쇄할 예정인지"를 뜻하는
-- print_copies로 대체한다.
ALTER TABLE "templates" DROP COLUMN "sobp_share_count";
ALTER TABLE "templates" DROP COLUMN "shared_ncode";
ALTER TABLE "templates" ADD COLUMN "print_copies" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "documents" DROP COLUMN "scan_page_no";
