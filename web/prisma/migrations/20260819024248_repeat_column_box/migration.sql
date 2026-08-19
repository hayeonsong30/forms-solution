/*
  Warnings:

  - Added the required column `box_h` to the `repeat_columns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `box_w` to the `repeat_columns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `box_x` to the `repeat_columns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `box_y` to the `repeat_columns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `label` to the `repeat_columns` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "repeat_columns" ADD COLUMN     "box_h" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "box_w" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "box_x" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "box_y" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "label" TEXT NOT NULL,
ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT false;
