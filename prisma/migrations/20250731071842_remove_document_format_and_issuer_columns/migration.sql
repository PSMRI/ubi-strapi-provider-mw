/*
  Warnings:

  - You are about to drop the column `documentFormat` on the `ApplicationFiles` table. All the data in the column will be lost.
  - You are about to drop the column `documentIssuer` on the `ApplicationFiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ApplicationFiles" DROP COLUMN "documentFormat",
DROP COLUMN "documentIssuer";
