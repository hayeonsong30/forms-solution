-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldType" ADD VALUE 'date';
ALTER TYPE "FieldType" ADD VALUE 'time';
ALTER TYPE "FieldType" ADD VALUE 'choice';

-- AlterTable
ALTER TABLE "templates" ALTER COLUMN "updated_at" DROP DEFAULT;
