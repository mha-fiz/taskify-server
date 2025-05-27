/*
  Warnings:

  - Added the required column `inviteCode` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "inviteCode" TEXT NOT NULL;
