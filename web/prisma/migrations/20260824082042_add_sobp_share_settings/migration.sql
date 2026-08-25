-- DropForeignKey
ALTER TABLE "excel_report_templates" DROP CONSTRAINT "excel_report_templates_template_version_id_fkey";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "scan_page_no" INTEGER;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "shared_ncode" TEXT,
ADD COLUMN     "sobp_share_count" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "excel_report_templates" ADD CONSTRAINT "excel_report_templates_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
