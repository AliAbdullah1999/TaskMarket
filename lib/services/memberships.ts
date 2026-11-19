import type { Prisma, SubscriptionPlan } from "@prisma/client";
import { MEMBERSHIP_DAYS, RENEWAL_WINDOW_DAYS } from "../constants";
import { prisma } from "../db";
import { activeMembershipWhere } from "../entitlements";
import { fail } from "../errors";
import { addDays } from "../time";
import { serializable } from "../transactions";
import type { Actor } from "./jobs";

const PLAN_FOR_ROLE: Partial<Record<Actor["userType"], SubscriptionPlan>> = {
  CANDIDATE: "CANDIDATE_PRO",
  EMPLOYER: "EMPLOYER_GROWTH",
};

const REFERENCE_PATTERN = /^[\w\-./# ]{3,100}$/;

export function planForRole(userType: Actor["userType"]) {
  return PLAN_FOR_ROLE[userType] ?? null;
}

export async function requestMembership(
  actor: Actor | null,
  input: { plan: string; reference: string },
  now = new Date(),
) {
  if (!actor) fail("Please log in to request a plan.");
  const plan = planForRole(actor.userType);
  if (!plan) fail("This account type does not have membership plans.");
  if (input.plan !== plan) fail("That plan is not available for this account type.");
  const reference = input.reference.trim();
  if (reference && !REFERENCE_PATTERN.test(reference)) {
    fail("Payment reference must be 3–100 letters, numbers, spaces or - . / # characters.");
  }

  return serializable(async (tx) => {
    const pending = await tx.subscription.findFirst({
      where: { userId: actor.id, status: "REQUESTED" },
      select: { id: true },
    });
    if (pending) fail("You already have a plan request awaiting review.");

    const upcoming = await tx.subscription.findFirst({
      where: { userId: actor.id, plan, status: "ACTIVE", currentPeriodStart: { gt: now } },
      select: { id: true },
    });
    if (upcoming) fail("Your renewal has already been approved.");

    const active = await tx.subscription.findFirst({
      where: activeMembershipWhere(actor.id, plan, now),
      orderBy: { currentPeriodEnd: "desc" },
      select: { currentPeriodEnd: true },
    });
    if (active?.currentPeriodEnd && now < addDays(active.currentPeriodEnd, -RENEWAL_WINDOW_DAYS)) {
      fail(`You already have an active plan. You can request a renewal in the last ${RENEWAL_WINDOW_DAYS} days of your membership.`);
    }

    return tx.subscription.create({
      data: { userId: actor.id, plan, requestedReference: reference || null },
      select: { id: true },
    });
  }, "Another plan request was submitted at the same time. Refresh the page to see its status.");
}

export async function cancelMembershipRequest(actor: Actor | null, subscriptionId: string) {
  if (!actor) fail("Please log in to continue.");
  const updated = await prisma.subscription.updateMany({
    where: { id: subscriptionId, userId: actor.id, status: "REQUESTED" },
    data: { status: "CANCELLED" },
  });
  if (!updated.count) fail("This request has already been reviewed or cancelled.");
}

function requireAdmin(actor: Actor | null): asserts actor is Actor {
  if (actor?.userType !== "ADMIN") fail("Admin access required.");
}

export async function logAdminAction(
  tx: Prisma.TransactionClient,
  adminId: string,
  action: string,
  target: { type: string; id: string },
  details?: Prisma.InputJsonValue,
) {
  await tx.adminAuditLog.create({
    data: { adminId, action, targetType: target.type, targetId: target.id, details },
  });
}

/**
 * Approves or rejects a pending request. Approval activates the membership for 30
 * days — starting now, or when the member's current period of the same plan ends,
 * so a renewal never shortens paid time. Only REQUESTED rows can be reviewed, so a
 * rejected, cancelled or already-approved request can never be activated.
 */
export async function reviewMembershipRequest(
  actor: Actor | null,
  input: { subscriptionId: string; decision: string; paymentReference: string; note: string },
  now = new Date(),
) {
  requireAdmin(actor);
  const note = input.note.trim();
  if (note.length > 500) fail("Review note must be 500 characters or fewer.");

  if (input.decision === "approve") {
    const paymentReference = input.paymentReference.trim();
    if (!REFERENCE_PATTERN.test(paymentReference)) fail("Enter the confirmed external payment reference (3–100 characters) before approving.");

    return serializable(async (tx) => {
      const request = await tx.subscription.findUnique({ where: { id: input.subscriptionId } });
      if (!request || request.status !== "REQUESTED") fail("This request has already been reviewed.");

      const current = await tx.subscription.findFirst({
        where: activeMembershipWhere(request.userId, request.plan, now),
        orderBy: { currentPeriodEnd: "desc" },
        select: { currentPeriodEnd: true },
      });
      const start = current?.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
      const end = addDays(start, MEMBERSHIP_DAYS);

      const updated = await tx.subscription.updateMany({
        where: { id: request.id, status: "REQUESTED" },
        data: {
          status: "ACTIVE",
          paymentReference,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          reviewedAt: now,
          reviewedById: actor.id,
          reviewNote: note || null,
        },
      });
      if (!updated.count) fail("This request has already been reviewed.");
      await logAdminAction(tx, actor.id, "MEMBERSHIP_APPROVED", { type: "Subscription", id: request.id }, {
        userId: request.userId,
        plan: request.plan,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      });
      return { start, end };
    }, "This request changed while you were reviewing it. Refresh and try again.");
  }

  if (input.decision === "reject") {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.updateMany({
        where: { id: input.subscriptionId, status: "REQUESTED" },
        data: { status: "REJECTED", reviewedAt: now, reviewedById: actor.id, reviewNote: note || null },
      });
      if (!updated.count) fail("This request has already been reviewed.");
      await logAdminAction(tx, actor.id, "MEMBERSHIP_REJECTED", { type: "Subscription", id: input.subscriptionId }, note ? { note } : undefined);
      return null;
    });
  }

  fail("Choose a valid review decision.");
}

export async function setAccountStatus(actor: Actor | null, input: { userId: string; status: string }) {
  requireAdmin(actor);
  const status = input.status === "ACTIVE" || input.status === "SUSPENDED" ? input.status : null;
  if (!status) fail("Unknown account status.");
  if (input.userId === actor.id) fail("You cannot change your own account status.");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, userType: true, status: true } });
    if (!target) fail("Account not found.");
    if (target.userType === "ADMIN") fail("Administrator accounts cannot be suspended from the console.");
    if (target.status === status) fail(status === "SUSPENDED" ? "This account is already suspended." : "This account is already active.");
    await tx.user.update({ where: { id: target.id }, data: { status } });
    await logAdminAction(tx, actor.id, status === "SUSPENDED" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_REACTIVATED", { type: "User", id: target.id }, {
      previousStatus: target.status,
    });
    return status;
  });
}
