-- Removes the retired TaskMarket services marketplace: its tables, their data and
-- the enum types only they used. THIS DELETES DATA and cannot be undone; back up
-- first if any of it must be kept. User accounts are not deleted.

-- DropTable (children before parents)
DROP TABLE "FBRReportRecord";
DROP TABLE "Payout";
DROP TABLE "Rating";
DROP TABLE "Message";
DROP TABLE "EscrowTransaction";
DROP TABLE "Quote";
DROP TABLE "Task";
DROP TABLE "TaskerProfile";

-- DropEnum
DROP TYPE "VerificationTier";
DROP TYPE "BackgroundStatus";
DROP TYPE "ProfileStatus";
DROP TYPE "TaskStatus";
DROP TYPE "AddressMode";
DROP TYPE "QuoteStatus";
DROP TYPE "EscrowStatus";
DROP TYPE "PayoutStatus";
DROP TYPE "MessageChannel";
DROP TYPE "VisibilityState";
DROP TYPE "FBRStatus";
