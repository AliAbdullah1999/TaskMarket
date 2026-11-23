-- MVP completion: email verification and password reset links, admin job removal,
-- employer invitations, and membership renewal reminders. Additive only.

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- Accounts created before email verification existed keep working as before.
UPDATE "User" SET "emailVerifiedAt" = "createdAt";

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "removedReason" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "renewalReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JobInvitation" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobInvitation_candidateId_createdAt_idx" ON "JobInvitation"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "JobInvitation_employerId_createdAt_idx" ON "JobInvitation"("employerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobInvitation_jobId_candidateId_key" ON "JobInvitation"("jobId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "JobInvitation" ADD CONSTRAINT "JobInvitation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInvitation" ADD CONSTRAINT "JobInvitation_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInvitation" ADD CONSTRAINT "JobInvitation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security, as on every other table (see the security_hardening migration).
ALTER TABLE "JobInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthToken" ENABLE ROW LEVEL SECURITY;
