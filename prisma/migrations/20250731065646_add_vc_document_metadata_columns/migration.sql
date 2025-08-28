-- AlterTable
ALTER TABLE "ApplicationFiles" ADD COLUMN     "documentFormat" TEXT,
ADD COLUMN     "documentIssuer" TEXT,
ADD COLUMN     "documentSubmissionReason" JSONB,
ADD COLUMN     "documentSubtype" TEXT,
ADD COLUMN     "documentType" TEXT;
