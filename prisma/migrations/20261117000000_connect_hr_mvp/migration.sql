-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "skillsNormalized" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "requestedReference" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedById" TEXT;

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "CandidateProfile_isPublic_updatedAt_idx" ON "CandidateProfile"("isPublic", "updatedAt");

-- CreateIndex
CREATE INDEX "Subscription_status_createdAt_idx" ON "Subscription"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: lower-cased skills for case-insensitive candidate search
UPDATE "CandidateProfile" SET "skillsNormalized" = ARRAY(SELECT lower(s) FROM unnest("skills") AS s);
