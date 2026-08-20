/*
  Warnings:

  - You are about to drop the `check_options` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "check_options" DROP CONSTRAINT "check_options_field_id_fkey";

-- DropTable
DROP TABLE "check_options";

-- CreateTable
CREATE TABLE "choice_options" (
    "id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "order_no" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "stored_value" TEXT NOT NULL,
    "region_x" DOUBLE PRECISION,
    "region_y" DOUBLE PRECISION,
    "region_w" DOUBLE PRECISION,
    "region_h" DOUBLE PRECISION,

    CONSTRAINT "choice_options_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "choice_options" ADD CONSTRAINT "choice_options_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
