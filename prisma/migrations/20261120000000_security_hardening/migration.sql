-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");


-- Row Level Security: enabled on every table with no policies, so only the table
-- owner (the role the application and migrations connect as) can read or write.
-- On hosted Postgres that exposes an HTTP data API (for example Supabase), this
-- stops the public "anon"/"authenticated" roles from reaching the tables directly.
-- The owner role bypasses RLS, so the application itself is unaffected.
-- Any table added in a later migration must enable RLS the same way (a test checks this).
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidateProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EscrowTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rating" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FBRReportRecord" ENABLE ROW LEVEL SECURITY;
