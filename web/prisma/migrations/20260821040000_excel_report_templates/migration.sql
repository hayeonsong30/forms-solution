-- Excel 플레이스홀더 템플릿 (doc/list) 간단 버전
CREATE TYPE "ExcelReportTemplateType" AS ENUM ('doc', 'list');
CREATE TYPE "ExcelReportTemplateStatus" AS ENUM ('validating', 'invalid', 'active');

CREATE TABLE "excel_report_templates" (
  "id" TEXT NOT NULL,
  "template_version_id" TEXT NOT NULL,
  "type" "ExcelReportTemplateType" NOT NULL,
  "name" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_data" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "status" "ExcelReportTemplateStatus" NOT NULL DEFAULT 'validating',
  "placeholder_count" INTEGER NOT NULL DEFAULT 0,
  "validation_result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "excel_report_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "excel_report_templates_template_version_id_type_key" ON "excel_report_templates"("template_version_id", "type");

ALTER TABLE "excel_report_templates" ADD CONSTRAINT "excel_report_templates_template_version_id_fkey"
  FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
