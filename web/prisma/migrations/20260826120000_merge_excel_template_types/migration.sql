-- Doc Excel / List Excel 타입 구분 제거 — 버전당 Excel 템플릿 1개로 통합
DROP INDEX "excel_report_templates_template_version_id_type_key";

ALTER TABLE "excel_report_templates" DROP COLUMN "type";

DROP TYPE "ExcelReportTemplateType";

CREATE UNIQUE INDEX "excel_report_templates_template_version_id_key" ON "excel_report_templates"("template_version_id");
