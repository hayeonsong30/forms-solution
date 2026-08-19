-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'field_user', 'reviewer');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('text', 'number', 'check');

-- CreateEnum
CREATE TYPE "FieldSource" AS ENUM ('manual', 'ai', 'copied');

-- CreateEnum
CREATE TYPE "FieldStatus" AS ENUM ('suggested', 'confirmed');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('printed', 'received', 'processing', 'review_required', 'confirmed', 'error');

-- CreateEnum
CREATE TYPE "ValueSource" AS ENUM ('ai', 'user', 'stroke_rule', 'empty_rule');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'needs_review', 'confirmed');

-- CreateEnum
CREATE TYPE "AiTargetType" AS ENUM ('template', 'document');

-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('form_detection', 'handwriting_ocr');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('queued', 'preprocessing', 'processing', 'validating', 'review_required', 'completed', 'retrying', 'failed');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('csv_single', 'csv_batch', 'excel_doc', 'excel_list');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'draft',
    "printable" BOOLEAN NOT NULL DEFAULT false,
    "printable_reason" TEXT,
    "current_version_id" TEXT,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "page_count" INTEGER NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "page_no" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "data_key" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "box_x" DOUBLE PRECISION NOT NULL,
    "box_y" DOUBLE PRECISION NOT NULL,
    "box_w" DOUBLE PRECISION NOT NULL,
    "box_h" DOUBLE PRECISION NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "source" "FieldSource" NOT NULL DEFAULT 'manual',
    "status" "FieldStatus" NOT NULL DEFAULT 'confirmed',
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_options" (
    "id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "region_x" DOUBLE PRECISION NOT NULL,
    "region_y" DOUBLE PRECISION NOT NULL,
    "region_w" DOUBLE PRECISION NOT NULL,
    "region_h" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "check_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repeat_groups" (
    "id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_key" TEXT NOT NULL,
    "page_no" INTEGER NOT NULL,
    "area_x" DOUBLE PRECISION NOT NULL,
    "area_y" DOUBLE PRECISION NOT NULL,
    "area_w" DOUBLE PRECISION NOT NULL,
    "area_h" DOUBLE PRECISION NOT NULL,
    "first_row_area" JSONB NOT NULL,
    "header_exclude_area" JSONB,
    "row_height" DOUBLE PRECISION NOT NULL,
    "max_rows" INTEGER NOT NULL,
    "blank_row_policy" TEXT NOT NULL,
    "use_row_number" BOOLEAN NOT NULL DEFAULT false,
    "allow_duplicate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "repeat_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repeat_columns" (
    "id" TEXT NOT NULL,
    "repeat_group_id" TEXT NOT NULL,
    "order_no" INTEGER NOT NULL,
    "data_key" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "repeat_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "ncode" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'printed',
    "page_images" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_values" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "field_id" TEXT,
    "repeat_group_id" TEXT,
    "repeat_column_id" TEXT,
    "row_index" INTEGER,
    "raw_ocr_value" TEXT,
    "normalized_value" TEXT,
    "final_value" TEXT,
    "value_source" "ValueSource",
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "review_reasons" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "prompt_version" TEXT,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL,
    "target_type" "AiTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "document_id" TEXT,
    "job_type" "AiJobType" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'queued',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "document_id" TEXT,
    "batch" JSONB,
    "export_type" "ExportType" NOT NULL,
    "file_url" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_template_id_version_no_key" ON "template_versions"("template_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "fields_template_version_id_data_key_key" ON "fields"("template_version_id", "data_key");

-- CreateIndex
CREATE UNIQUE INDEX "repeat_groups_template_version_id_data_key_key" ON "repeat_groups"("template_version_id", "data_key");

-- CreateIndex
CREATE UNIQUE INDEX "repeat_columns_repeat_group_id_data_key_key" ON "repeat_columns"("repeat_group_id", "data_key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_options" ADD CONSTRAINT "check_options_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repeat_groups" ADD CONSTRAINT "repeat_groups_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repeat_columns" ADD CONSTRAINT "repeat_columns_repeat_group_id_fkey" FOREIGN KEY ("repeat_group_id") REFERENCES "repeat_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_repeat_group_id_fkey" FOREIGN KEY ("repeat_group_id") REFERENCES "repeat_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_repeat_column_id_fkey" FOREIGN KEY ("repeat_column_id") REFERENCES "repeat_columns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
