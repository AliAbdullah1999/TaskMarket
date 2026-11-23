import { RENEWAL_WINDOW_DAYS } from "../constants";
import { prisma } from "../db";
import { expireLapsedMemberships } from "../entitlements";
import { notifyRenewalDue } from "../notifications";
import { purgeExpiredRateLimits } from "../rate-limit";
import { addDays } from "../time";
import { purgeExpiredTokens } from "./recovery";

/**
 * Housekeeping run once a day by /api/cron/daily. Every step is safe to repeat and
 * none of them grants or removes access: entitlements are always checked by date.
 */
export async function runDailyMaintenance(now = new Date()) {
  const expiredMemberships = await expireLapsedMemberships(prisma, now);
  await purgeExpiredRateLimits(now);
  const purgedTokens = await purgeExpiredTokens(now);

  // Remind members once, when their renewal window opens, unless a renewal is already requested or approved.
  const due = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      renewalReminderSentAt: null,
      currentPeriodEnd: { gt: now, lte: addDays(now, RENEWAL_WINDOW_DAYS) },
      user: { status: "ACTIVE" },
    },
    select: { id: true, userId: true, plan: true, currentPeriodEnd: true },
    take: 500,
  });
  let renewalReminders = 0;
  for (const subscription of due) {
    const followUp = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        plan: subscription.plan,
        id: { not: subscription.id },
        OR: [{ status: "REQUESTED" }, { status: "ACTIVE", currentPeriodEnd: { gt: subscription.currentPeriodEnd! } }],
      },
      select: { id: true },
    });
    // Claim the reminder first so two overlapping runs cannot both send it.
    const claimed = await prisma.subscription.updateMany({
      where: { id: subscription.id, renewalReminderSentAt: null },
      data: { renewalReminderSentAt: now },
    });
    if (!claimed.count || followUp) continue;
    await notifyRenewalDue(subscription.id);
    renewalReminders += 1;
  }
  return { expiredMemberships, purgedTokens, renewalReminders };
}
