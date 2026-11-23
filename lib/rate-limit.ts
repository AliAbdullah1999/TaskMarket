import { createHash } from "node:crypto";
import { prisma } from "./db";
import { fail } from "./errors";

/**
 * Fixed-window rate limiting stored in PostgreSQL, so limits hold across
 * serverless instances and restarts. One atomic statement per check.
 */
export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  /** Failed-password guesses against one account. */
  loginPerAccount: { limit: 5, windowSeconds: 15 * 60 },
  /** All sign-in attempts from one network address. */
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  signupPerIp: { limit: 5, windowSeconds: 60 * 60 },
  passwordChange: { limit: 5, windowSeconds: 15 * 60 },
  membershipRequest: { limit: 6, windowSeconds: 60 * 60 },
  accountDeletion: { limit: 5, windowSeconds: 15 * 60 },
  /** Reset emails to one address; further requests in the window are silently ignored. */
  passwordResetPerEmail: { limit: 3, windowSeconds: 60 * 60 },
  passwordResetPerIp: { limit: 10, windowSeconds: 60 * 60 },
  verificationResend: { limit: 3, windowSeconds: 60 * 60 },
  /** Invitations one employer may send to candidates per day. */
  candidateInvites: { limit: 30, windowSeconds: 24 * 60 * 60 },
} satisfies Record<string, RateLimitRule>;

/** Keys never contain raw emails or addresses; they are hashed first. */
export function rateLimitKey(scope: string, subject: string) {
  return `${scope}:${createHash("sha256").update(subject.toLowerCase()).digest("hex").slice(0, 40)}`;
}

export async function consumeRateLimit(key: string, rule: RateLimitRule, now = new Date()) {
  // Timestamps are passed as ISO strings and cast to `timestamp`, which ignores the
  // zone suffix. That stores plain UTC, matching how Prisma reads and writes these
  // columns, whatever time zone the database session uses.
  const nowUtc = now.toISOString();
  const expiresUtc = new Date(now.getTime() + rule.windowSeconds * 1000).toISOString();
  const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${nowUtc}::timestamp, ${expiresUtc}::timestamp)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${nowUtc}::timestamp THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."expiresAt" <= ${nowUtc}::timestamp THEN ${nowUtc}::timestamp ELSE "RateLimit"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${nowUtc}::timestamp THEN ${expiresUtc}::timestamp ELSE "RateLimit"."expiresAt" END
    RETURNING "count", "expiresAt"`;
  const row = rows[0];
  const retryAfterSeconds = Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000));
  return { allowed: row.count <= rule.limit, count: row.count, retryAfterSeconds };
}

/** Whether the key is currently over its limit, without counting a new attempt. */
export async function isRateLimited(key: string, rule: RateLimitRule, now = new Date()) {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row || row.expiresAt <= now || row.count < rule.limit) return null;
  return Math.max(1, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000));
}

export async function resetRateLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

export function tooManyAttempts(retryAfterSeconds: number): never {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  fail(`Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
}

export async function enforceRateLimit(key: string, rule: RateLimitRule, now = new Date()) {
  const result = await consumeRateLimit(key, rule, now);
  if (!result.allowed) tooManyAttempts(result.retryAfterSeconds);
}

/** Removes expired counters. Called opportunistically; safe to run at any time. */
export async function purgeExpiredRateLimits(now = new Date()) {
  await prisma.rateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
}
