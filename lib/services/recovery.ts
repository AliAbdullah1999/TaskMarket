import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenPurpose } from "@prisma/client";
import { APP_NAME } from "../constants";
import { prisma } from "../db";
import { appUrl, sendEmail } from "../email";
import { fail } from "../errors";
import { hashPassword } from "../password";
import { RATE_LIMITS, consumeRateLimit, enforceRateLimit, rateLimitKey, resetRateLimit } from "../rate-limit";
import { validatePassword } from "./accounts";
import type { Actor } from "./jobs";

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;

/** Only this hash is stored, so a database leak does not yield usable links. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a single-use token, replacing any unused token of the same kind for that user. */
async function issueToken(userId: string, purpose: AuthTokenPurpose, ttlMs: number, now: Date) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.authToken.create({ data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + ttlMs) } }),
  ]);
  return token;
}

async function findUsableToken(token: string, purpose: AuthTokenPurpose, now: Date) {
  if (!token || token.length > 200) return null;
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, status: true, emailVerifiedAt: true } } },
  });
  if (!record || record.purpose !== purpose) return null;
  return { record, usable: !record.usedAt && record.expiresAt > now };
}

/** Emails a verification link. Does nothing for an address that is already verified. */
export async function sendVerificationEmail(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true, emailVerifiedAt: true } });
  if (!user || user.emailVerifiedAt) return false;
  const token = await issueToken(userId, "EMAIL_VERIFICATION", VERIFY_TTL_MS, now);
  return sendEmail({
    to: user.email,
    subject: `Confirm your email for ${APP_NAME}`,
    text: `Hi ${user.fullName},\n\nConfirm your email address to start applying for jobs or publishing listings on ${APP_NAME}:\n\n${appUrl(`/verify-email?token=${token}`)}\n\nThis link works for 48 hours. If you did not create this account, you can ignore this email.`,
  });
}

export async function resendVerification(actor: Actor | null, now = new Date()) {
  if (!actor) fail("Please log in to continue.");
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { emailVerifiedAt: true } });
  if (user?.emailVerifiedAt) fail("Your email address is already confirmed.");
  await enforceRateLimit(rateLimitKey("verify-resend", actor.id), RATE_LIMITS.verificationResend, now);
  await sendVerificationEmail(actor.id, now);
}

/** Confirms the address the link was sent to. Following the same link twice still reports success. */
export async function verifyEmailWithToken(token: string, now = new Date()) {
  const found = await findUsableToken(token, "EMAIL_VERIFICATION", now);
  if (!found) return false;
  if (!found.usable) return Boolean(found.record.usedAt && found.record.user.emailVerifiedAt);
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: found.record.id }, data: { usedAt: now } }),
    prisma.user.update({ where: { id: found.record.userId }, data: { emailVerifiedAt: found.record.user.emailVerifiedAt ?? now } }),
  ]);
  return true;
}

/**
 * Emails a password-reset link if the address belongs to an active account.
 * The caller always shows the same confirmation, and unknown or throttled addresses
 * are skipped silently, so the form does not reveal which emails are registered.
 */
export async function requestPasswordReset(emailInput: string, context: { ip?: string } = {}, now = new Date()) {
  const email = emailInput.trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes("@")) fail("Please enter a valid email address.");
  if (context.ip) await enforceRateLimit(rateLimitKey("reset:ip", context.ip), RATE_LIMITS.passwordResetPerIp, now);
  const perEmail = await consumeRateLimit(rateLimitKey("reset:email", email), RATE_LIMITS.passwordResetPerEmail, now);
  if (!perEmail.allowed) return;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, fullName: true, status: true } });
  if (!user || user.status === "SUSPENDED" || user.status === "BANNED") return;
  const token = await issueToken(user.id, "PASSWORD_RESET", RESET_TTL_MS, now);
  await sendEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    text: `Hi ${user.fullName},\n\nWe received a request to reset your password. Choose a new one here:\n\n${appUrl(`/reset-password?token=${token}`)}\n\nThis link works for 1 hour and can be used once. If you did not ask for this, you can ignore this email; your password has not changed.`,
  });
}

export async function isPasswordResetTokenValid(token: string, now = new Date()) {
  return Boolean((await findUsableToken(token, "PASSWORD_RESET", now))?.usable);
}

/**
 * Sets a new password from an emailed link. The link is single-use, every existing
 * session is signed out, and the sign-in lockout for the account is cleared. Using
 * the link also proves control of the inbox, so the email is marked verified.
 */
export async function resetPasswordWithToken(input: { token: string; newPassword: string }, now = new Date()) {
  const invalid = "This reset link is invalid or has expired. Please request a new one.";
  const found = await findUsableToken(input.token, "PASSWORD_RESET", now);
  if (!found?.usable) fail(invalid);
  const { record } = found;
  if (record.user.status === "SUSPENDED" || record.user.status === "BANNED") fail("This account has been suspended. Contact support for help.");
  validatePassword(input.newPassword, { email: record.user.email });
  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    // Claiming the token and changing the password happen together, so a link cannot be used twice.
    const claimed = await tx.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
    if (!claimed.count) fail(invalid);
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 }, emailVerifiedAt: record.user.emailVerifiedAt ?? now },
    });
  });
  await resetRateLimit(rateLimitKey("login:account", record.user.email));
}

/** Removes links that can no longer be used. Called by the daily maintenance job. */
export async function purgeExpiredTokens(now = new Date()) {
  const result = await prisma.authToken.deleteMany({ where: { expiresAt: { lte: now } } });
  return result.count;
}
