/*
  Warnings:

  - Added the required column `position` to the `Tasks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tasks" ADD COLUMN     "position" INTEGER NOT NULL;
