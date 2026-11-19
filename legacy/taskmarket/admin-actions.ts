// LEGACY TASKMARKET — not imported anywhere, so Next.js does not expose these as server actions.
// Kept for reference until the legacy marketplace data is retired. See docs/CONNECT_HR_IMPLEMENTATION_REPORT.md.
"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, fail, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refundEscrow, releaseEscrow } from "@/lib/escrow";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.userType !== "ADMIN") fail("Admin access required.");
  return user;
}

export async function reviewNtn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdmin();
    const profileId = text(formData, "profileId");
    const decision = text(formData, "decision");
    const profile = await prisma.taskerProfile.findUnique({ where: { id: profileId } });
    if (!profile?.ntin) fail("Profile has no NTN to review.");

    if (decision === "approve") {
      await prisma.taskerProfile.update({
        where: { id: profileId },
        data: {
          ntinVerified: true,
          status: "ACTIVE",
          backgroundCheckStatus: "APPROVED",
          verificationTier: profile.verificationTier === "BASIC" ? "TRUSTED" : profile.verificationTier,
        },
      });
    } else if (decision === "reject") {
      await prisma.taskerProfile.update({
        where: { id: profileId },
        data: { ntinVerified: false, ntin: null, status: "ACTIVE", backgroundCheckStatus: "REJECTED" },
      });
    } else {
      fail("Unknown decision.");
    }
    revalidatePath("/admin");
    return decision === "approve" ? "NTN approved." : "NTN rejected; the tasker must resubmit.";
  });
}

export async function resolveDispute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const escrowId = text(formData, "escrowId");
    const outcome = text(formData, "outcome");
    const note = text(formData, "note");

    const escrow = await prisma.escrowTransaction.findUnique({ where: { id: escrowId } });
    if (!escrow || escrow.status !== "DISPUTED") fail("This dispute is no longer open.");

    const suffix = note ? ` Note: ${note}` : "";
    const done = await prisma.$transaction((tx) =>
      outcome === "release"
        ? releaseEscrow(tx, escrowId, admin.id, `Dispute resolved by TaskMarket: payment released to the tasker.${suffix}`)
        : outcome === "refund"
          ? refundEscrow(tx, escrowId, admin.id, `Dispute resolved by TaskMarket: payment refunded to the customer.${suffix}`)
          : Promise.resolve(false),
    );
    if (!done) fail("Could not resolve this dispute.");
    revalidatePath("/admin");
    revalidatePath(`/tasks/${escrow.taskId}`);
    return outcome === "release" ? "Released to tasker." : "Refunded to customer.";
  });
}

export async function markPayoutPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdmin();
    const updated = await prisma.payout.updateMany({
      where: { id: text(formData, "payoutId"), status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (updated.count === 0) fail("Payout already settled.");
    revalidatePath("/admin");
    return "Payout marked as paid.";
  });
}
