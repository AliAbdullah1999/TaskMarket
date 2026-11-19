-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('CUSTOMER', 'TASKER', 'BUSINESS', 'CANDIDATE', 'EMPLOYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('CANDIDATE_PRO', 'EMPLOYER_GROWTH');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "VerificationTier" AS ENUM ('BASIC', 'TRUSTED', 'HIGH_TRUST');

-- CreateEnum
CREATE TYPE "BackgroundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'MATCHED', 'ASSIGNED', 'ESCROW_ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AddressMode" AS ENUM ('HIDDEN', 'DISCLOSED_AFTER_ESCROW');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'FUNDED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('IN_APP', 'VOICE_PROXY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "VisibilityState" AS ENUM ('ACTIVE', 'MASKED', 'READ_ONLY', 'CLOSED');

-- CreateEnum
CREATE TYPE "FBRStatus" AS ENUM ('PENDING', 'GENERATED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PK',
    "city" TEXT,
    "userType" "UserType" NOT NULL,
    "businessName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ntin" TEXT,
    "ntinVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationTier" "VerificationTier" NOT NULL DEFAULT 'BASIC',
    "categories" TEXT[],
    "serviceAreas" TEXT[],
    "bio" TEXT,
    "priceFrom" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "backgroundCheckStatus" "BackgroundStatus" NOT NULL DEFAULT 'PENDING',
    "status" "ProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "skills" TEXT[],
    "experienceYears" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "workplaceType" "WorkplaceType" NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "coverLetter" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentReference" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "preferredDate" TIMESTAMP(3),
    "durationHours" INTEGER,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT NOT NULL,
    "taskerId" TEXT,
    "requirements" JSONB,
    "addressMode" "AddressMode" NOT NULL DEFAULT 'DISCLOSED_AFTER_ESCROW',
    "addressEncrypted" TEXT,
    "taskerCompletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskerId" TEXT NOT NULL,
    "quoteText" TEXT NOT NULL,
    "amountPKR" INTEGER NOT NULL,
    "etaHours" INTEGER NOT NULL,
    "scopeSummary" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "taskerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "commissionPct" INTEGER NOT NULL DEFAULT 11,
    "commissionAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'FUNDED',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escrowedAt" TIMESTAMP(3),
    "autoReleaseAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "escrowTransactionId" TEXT NOT NULL,
    "taskerId" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'bank_transfer',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "channelType" "MessageChannel" NOT NULL DEFAULT 'IN_APP',
    "body" TEXT NOT NULL,
    "visibilityState" "VisibilityState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "professionalism" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FBRReportRecord" (
    "id" TEXT NOT NULL,
    "reportMonth" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT NOT NULL,
    "taskId" TEXT,
    "transactionId" TEXT,
    "grossSales" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "netPayout" INTEGER NOT NULL,
    "status" "FBRStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escrowTransactionId" TEXT,

    CONSTRAINT "FBRReportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TaskerProfile_userId_key" ON "TaskerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerProfile_userId_key" ON "EmployerProfile"("userId");

-- CreateIndex
CREATE INDEX "Job_status_city_category_createdAt_idx" ON "Job"("status", "city", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Job_employerId_status_idx" ON "Job"("employerId", "status");

-- CreateIndex
CREATE INDEX "JobApplication_candidateId_createdAt_idx" ON "JobApplication"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "JobApplication_employerId_status_createdAt_idx" ON "JobApplication"("employerId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_candidateId_key" ON "JobApplication"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_currentPeriodEnd_idx" ON "Subscription"("userId", "status", "currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Task_status_category_city_idx" ON "Task"("status", "category", "city");

-- CreateIndex
CREATE INDEX "Task_customerId_idx" ON "Task"("customerId");

-- CreateIndex
CREATE INDEX "Task_taskerId_idx" ON "Task"("taskerId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_taskId_taskerId_key" ON "Quote"("taskId", "taskerId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_taskId_key" ON "EscrowTransaction"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_escrowTransactionId_key" ON "Payout"("escrowTransactionId");

-- CreateIndex
CREATE INDEX "Message_taskId_createdAt_idx" ON "Message"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_taskId_fromUserId_key" ON "Rating"("taskId", "fromUserId");

-- CreateIndex
CREATE INDEX "FBRReportRecord_reportMonth_sellerId_idx" ON "FBRReportRecord"("reportMonth", "sellerId");

-- AddForeignKey
ALTER TABLE "TaskerProfile" ADD CONSTRAINT "TaskerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerProfile" ADD CONSTRAINT "EmployerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskerId_fkey" FOREIGN KEY ("taskerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_taskerId_fkey" FOREIGN KEY ("taskerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_escrowTransactionId_fkey" FOREIGN KEY ("escrowTransactionId") REFERENCES "EscrowTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_taskerId_fkey" FOREIGN KEY ("taskerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FBRReportRecord" ADD CONSTRAINT "FBRReportRecord_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FBRReportRecord" ADD CONSTRAINT "FBRReportRecord_escrowTransactionId_fkey" FOREIGN KEY ("escrowTransactionId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

