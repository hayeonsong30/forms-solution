-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "page_ncodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
