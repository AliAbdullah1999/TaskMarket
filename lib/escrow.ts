import type { Prisma } from "@prisma/client";
import { reportMonthFor } from "./compliance";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient;

/**
 * Releases a funded (or disputed) escrow to the tasker: completes the task,
 * queues a payout and writes the FBR ledger row. Safe to call twice — the
 * conditional update means only the first caller wins.
 */
export async function releaseEscrow(tx: Tx, escrowId: string, actorId: string, note: string) {
  const now = new Date();
  const claimed = await tx.escrowTransaction.updateMany({
    where: { id: escrowId, status: { in: ["FUNDED", "DISPUTED"] } },
    data: { status: "RELEASED", releasedAt: now, autoReleaseAt: null },
  });
  if (claimed.count === 0) return false;

  const escrow = await tx.escrowTransaction.findUniqueOrThrow({ where: { id: escrowId } });

  await tx.task.update({
    where: { id: escrow.taskId },
    data: { status: "COMPLETED", completedAt: now },
  });

  await tx.payout.create({
    data: {
      escrowTransactionId: escrow.id,
      taskerId: escrow.taskerId,
      grossAmount: escrow.amount,
      commissionAmount: escrow.commissionAmount,
      netAmount: escrow.netAmount,
    },
  });

  await tx.fBRReportRecord.create({
    data: {
      reportMonth: reportMonthFor(now),
      sellerId: escrow.taskerId,
      taskId: escrow.taskId,
      transactionId: escrow.paymentReference,
      escrowTransactionId: escrow.id,
      grossSales: escrow.amount,
      commissionAmount: escrow.commissionAmount,
      netPayout: escrow.netAmount,
    },
  });

  await tx.taskerProfile.updateMany({
    where: { userId: escrow.taskerId },
    data: { completedJobs: { increment: 1 } },
  });

  await tx.message.create({
    data: { taskId: escrow.taskId, senderId: actorId, channelType: "SYSTEM", body: note },
  });

  return true;
}

export async function refundEscrow(tx: Tx, escrowId: string, actorId: string, note: string) {
  const claimed = await tx.escrowTransaction.updateMany({
    where: { id: escrowId, status: { in: ["FUNDED", "DISPUTED"] } },
    data: { status: "REFUNDED", refundedAt: new Date(), autoReleaseAt: null },
  });
  if (claimed.count === 0) return false;

  const escrow = await tx.escrowTransaction.findUniqueOrThrow({ where: { id: escrowId } });
  await tx.task.update({ where: { id: escrow.taskId }, data: { status: "CANCELLED" } });
  await tx.message.create({
    data: { taskId: escrow.taskId, senderId: actorId, channelType: "SYSTEM", body: note },
  });
  return true;
}

/**
 * Releases every escrow whose 48-hour confirmation window has lapsed.
 * Run from the cron route; also called opportunistically on dashboard loads.
 */
export async function runAutoRelease() {
  const due = await prisma.escrowTransaction.findMany({
    where: { status: "FUNDED", autoReleaseAt: { lte: new Date() } },
    select: { id: true, taskerId: true },
    take: 50,
  });

  let released = 0;
  for (const escrow of due) {
    const ok = await prisma.$transaction((tx) =>
      releaseEscrow(
        tx,
        escrow.id,
        escrow.taskerId,
        "Escrow auto-released: the customer did not respond within the confirmation window.",
      ),
    );
    if (ok) released += 1;
  }
  return released;
}

export async function recalculateTaskerRating(tx: Tx, taskerId: string) {
  const stats = await tx.rating.aggregate({
    where: { toUserId: taskerId },
    _avg: { overall: true },
    _count: true,
  });
  await tx.taskerProfile.updateMany({
    where: { userId: taskerId },
    data: {
      rating: Math.round((stats._avg.overall ?? 0) * 10) / 10,
      ratingCount: stats._count,
    },
  });
}
