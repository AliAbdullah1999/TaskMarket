import type { Prisma, PrismaClient, SubscriptionPlan } from "@prisma/client";
import {
  FREE_ACTIVE_JOB_LIMIT,
  FREE_APPLICATION_LIMIT,
  GROWTH_ACTIVE_JOB_LIMIT,
  RENEWAL_WINDOW_DAYS,
} from "./constants";
import { addDays, pktMonthStart, pktNextMonthStart } from "./time";

/**
 * The single source of truth for plan entitlements. Pages use these helpers to
 * render limits, and the services call them inside their transactions to enforce
 * the limits, so what the UI shows and what the server enforces cannot drift apart.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

/** A membership grants benefits only while it is ACTIVE and `now` is inside its paid period. */
export function activeMembershipWhere(userId: string, plan: SubscriptionPlan, now: Date): Prisma.SubscriptionWhereInput {
  return {
    userId,
    plan,
    status: "ACTIVE",
    currentPeriodEnd: { gt: now },
    OR: [{ currentPeriodStart: null }, { currentPeriodStart: { lte: now } }],
  };
}

export async function getActiveMembership(db: Db, userId: string, plan: SubscriptionPlan, now = new Date()) {
  return db.subscription.findFirst({
    where: activeMembershipWhere(userId, plan, now),
    orderBy: { currentPeriodEnd: "desc" },
  });
}

export async function hasActivePlan(db: Db, userId: string, plan: SubscriptionPlan, now = new Date()) {
  return Boolean(
    await db.subscription.findFirst({ where: activeMembershipWhere(userId, plan, now), select: { id: true } }),
  );
}

/** Jobs that are open and have not passed their expiry date. Compose with `AND: [...]`. */
export function activeJobWhere(now: Date): Prisma.JobWhereInput {
  return { status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

export function isJobAcceptingApplications(job: { status: string; expiresAt: Date | null }, now = new Date()) {
  return job.status === "OPEN" && (!job.expiresAt || job.expiresAt > now);
}

export async function getEmployerJobAllowance(db: Db, employerId: string, now = new Date()) {
  const [isGrowth, active] = await Promise.all([
    hasActivePlan(db, employerId, "EMPLOYER_GROWTH", now),
    db.job.count({ where: { AND: [{ employerId }, activeJobWhere(now)] } }),
  ]);
  const limit = isGrowth ? GROWTH_ACTIVE_JOB_LIMIT : FREE_ACTIVE_JOB_LIMIT;
  return { isGrowth, limit, active, remaining: Math.max(0, limit - active), canPublish: active < limit };
}

export async function getCandidateApplicationAllowance(db: Db, candidateId: string, now = new Date()) {
  const [isPro, used] = await Promise.all([
    hasActivePlan(db, candidateId, "CANDIDATE_PRO", now),
    // Every application in the PKT calendar month counts, whatever its later status.
    db.jobApplication.count({ where: { candidateId, createdAt: { gte: pktMonthStart(now) } } }),
  ]);
  const limit = isPro ? null : FREE_APPLICATION_LIMIT;
  return {
    isPro,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    canApply: limit === null || used < limit,
    resetsAt: pktNextMonthStart(now),
  };
}

export function canSearchCandidates(db: Db, employerId: string, now = new Date()) {
  return hasActivePlan(db, employerId, "EMPLOYER_GROWTH", now);
}

/**
 * Marks memberships whose paid period has ended as EXPIRED. Entitlement checks
 * already ignore lapsed memberships by date, so this only keeps status and
 * history accurate; running it late never grants extra access.
 */
export async function expireLapsedMemberships(db: Db, now = new Date()) {
  const result = await db.subscription.updateMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

/** Everything a member page needs to describe a user's plan state. */
export async function getMembershipOverview(db: Db, userId: string, plan: SubscriptionPlan, now = new Date()) {
  const [active, upcoming, pending, history] = await Promise.all([
    getActiveMembership(db, userId, plan, now),
    db.subscription.findFirst({
      where: { userId, plan, status: "ACTIVE", currentPeriodStart: { gt: now } },
      orderBy: { currentPeriodStart: "asc" },
    }),
    db.subscription.findFirst({ where: { userId, status: "REQUESTED" }, orderBy: { createdAt: "desc" } }),
    db.subscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const renewalOpensAt = active?.currentPeriodEnd ? addDays(active.currentPeriodEnd, -RENEWAL_WINDOW_DAYS) : null;
  const canRequest = !pending && !upcoming && (!active || (renewalOpensAt !== null && now >= renewalOpensAt));
  return { active, upcoming, pending, history, renewalOpensAt, canRequest };
}
