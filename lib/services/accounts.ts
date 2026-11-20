import { CITIES } from "../constants";
import { prisma } from "../db";
import { fail } from "../errors";
import { hashPassword, verifyPassword } from "../password";
import {
  RATE_LIMITS,
  consumeRateLimit,
  enforceRateLimit,
  isRateLimited,
  rateLimitKey,
  resetRateLimit,
  tooManyAttempts,
} from "../rate-limit";
import { isUniqueViolation } from "../transactions";
import type { Actor } from "./jobs";

export const PHONE_PATTERN = /^(\+92|0)3\d{9}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(value: string) {
  return value.replace(/[\s-]/g, "");
}

// A short list of the passwords attackers try first. Length and this check matter
// more than forced symbol rules (NIST SP 800-63B).
const COMMON_PASSWORDS = new Set([
  "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "qwerty123", "qwerty1234", "abc12345",
  "abcd1234", "1q2w3e4r", "1qaz2wsx", "12345678a", "a1234567", "a12345678", "iloveyou1", "welcome1", "welcome123",
  "admin123", "admin1234", "letmein1", "letmein123", "pakistan1", "pakistan123", "pakistan786", "lahore123", "karachi123",
  "islamabad1", "allah786", "bismillah786", "monkey123", "dragon123", "football1", "cricket123", "sunshine1", "princess1",
  "changeme1", "test1234", "temp1234", "qazwsx123", "zaq12wsx", "asdf1234", "asdfgh123", "computer1", "master123",
]);

export function validatePassword(password: string, context: { email?: string } = {}) {
  if (password.length < 8 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    fail("Password must be 8–128 characters and include a letter and a number.");
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) fail("That password is too common and easy to guess. Please choose a different one.");
  const emailName = context.email?.split("@")[0]?.toLowerCase() ?? "";
  if (emailName.length >= 4 && lower.includes(emailName)) fail("Your password should not contain your email address.");
}

export function validateName(fullName: string) {
  if (fullName.length < 2 || fullName.length > 100) fail("Please enter your full name (2–100 characters).");
}

const SIGNUP_ROLES = ["CANDIDATE", "EMPLOYER"] as const;

export type RegistrationInput = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  userType: string;
  businessName: string;
  /** The user ticked the Terms of Service and Privacy Policy box. */
  acceptTerms: boolean;
  /** Network address of the request. Used only for rate limiting. */
  ip?: string;
};

/**
 * Creates a candidate or employer account. The role is whitelisted here, so a
 * crafted request can never register an ADMIN (or legacy) account.
 */
export async function registerUser(input: RegistrationInput) {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone.trim());
  const city = input.city.trim();
  const userType = SIGNUP_ROLES.find((role) => role === input.userType);
  if (!userType) fail("Choose whether you are joining as a candidate or employer.");
  const businessName = userType === "EMPLOYER" ? input.businessName.trim() : "";

  validateName(fullName);
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) fail("Please enter a valid email address.");
  if (!(CITIES as readonly string[]).includes(city)) fail("Choose your city.");
  if (phone && !PHONE_PATTERN.test(phone)) fail("Enter a Pakistani mobile number like 03001234567.");
  validatePassword(input.password, { email });
  if (userType === "EMPLOYER" && (businessName.length < 2 || businessName.length > 120)) {
    fail("Enter your company name (2–120 characters).");
  }
  if (!input.acceptTerms) fail("Please accept the Terms of Service and Privacy Policy to create an account.");
  if (input.ip) await enforceRateLimit(rateLimitKey("signup:ip", input.ip), RATE_LIMITS.signupPerIp);

  try {
    return await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        city,
        userType,
        businessName: businessName || null,
        passwordHash: await hashPassword(input.password),
        termsAcceptedAt: new Date(),
        candidateProfile: userType === "CANDIDATE" ? { create: { skills: [] } } : undefined,
        employerProfile: userType === "EMPLOYER" ? { create: { companyName: businessName } } : undefined,
      },
      select: { id: true, userType: true, sessionVersion: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) fail("An account with this email already exists. Log in instead.");
    throw error;
  }
}

// Compared against when the email is unknown, so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;

/**
 * Verifies credentials and account status.
 * - Every credential failure returns the same message, and unknown emails cost the
 *   same time as wrong passwords, so the form does not reveal which emails exist.
 * - Five wrong passwords lock sign-in for that account for 15 minutes. Each
 *   network address is also limited, which blunts password spraying.
 */
export async function authenticate(emailInput: string, password: string, context: { ip?: string } = {}) {
  const email = emailInput.trim().toLowerCase();
  if (!email || !password || email.length > 254 || password.length > 128) fail("Incorrect email or password.");

  if (context.ip) await enforceRateLimit(rateLimitKey("login:ip", context.ip), RATE_LIMITS.loginPerIp);
  const accountKey = rateLimitKey("login:account", email);
  const lockedFor = await isRateLimited(accountKey, RATE_LIMITS.loginPerAccount);
  if (lockedFor) tooManyAttempts(lockedFor);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, status: true, sessionVersion: true },
  });
  let valid = false;
  if (user) {
    valid = await verifyPassword(password, user.passwordHash);
  } else {
    dummyHash ??= hashPassword("connect-hr-timing-equaliser-1");
    await verifyPassword(password, await dummyHash);
  }
  if (!user || !valid) {
    // Counted for unknown emails too, so lockout behaviour does not reveal which accounts exist.
    await consumeRateLimit(accountKey, RATE_LIMITS.loginPerAccount);
    fail("Incorrect email or password.");
  }
  if (user.status === "SUSPENDED" || user.status === "BANNED") fail("This account has been suspended. Contact support for help.");
  await resetRateLimit(accountKey);
  return { id: user.id, sessionVersion: user.sessionVersion };
}

/** Updates the signed-in user's own account details. The user id always comes from the session. */
export async function updateAccountDetails(actor: Actor | null, input: { fullName: string; city: string; phone: string }) {
  if (!actor) fail("Please log in to continue.");
  const fullName = input.fullName.trim();
  const city = input.city.trim();
  const phone = normalizePhone(input.phone.trim());
  validateName(fullName);
  if (!(CITIES as readonly string[]).includes(city)) fail("Choose your city.");
  if (phone && !PHONE_PATTERN.test(phone)) fail("Enter a Pakistani mobile number like 03001234567.");
  await prisma.user.update({ where: { id: actor.id }, data: { fullName, city, phone: phone || null } });
}

/**
 * Changes the password and signs out every other device by bumping the session
 * version. Returns the new version so the caller can keep this device signed in.
 */
export async function changePassword(actor: Actor | null, input: { currentPassword: string; newPassword: string }) {
  if (!actor) fail("Please log in to continue.");
  await enforceRateLimit(rateLimitKey("password-change", actor.id), RATE_LIMITS.passwordChange);
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true, email: true } });
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) fail("Your current password is incorrect.");
  validatePassword(input.newPassword, { email: user.email });
  if (input.currentPassword === input.newPassword) fail("Choose a new password that is different from your current one.");
  const updated = await prisma.user.update({
    where: { id: actor.id },
    data: { passwordHash: await hashPassword(input.newPassword), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return updated.sessionVersion;
}

/** Invalidates every session for the account, on every device. */
export async function signOutEverywhere(actor: Actor | null) {
  if (!actor) fail("Please log in to continue.");
  await prisma.user.update({ where: { id: actor.id }, data: { sessionVersion: { increment: 1 } } });
}

/** Everything the platform stores about the signed-in user, for a data-access request. */
export async function exportAccountData(actor: Actor | null) {
  if (!actor) fail("Please log in to continue.");
  const account = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      fullName: true,
      email: true,
      phone: true,
      city: true,
      userType: true,
      businessName: true,
      status: true,
      createdAt: true,
      termsAcceptedAt: true,
      candidateProfile: { select: { headline: true, summary: true, skills: true, experienceYears: true, isPublic: true, updatedAt: true } },
      employerProfile: { select: { companyName: true, website: true, industry: true, description: true, updatedAt: true } },
      applications: {
        orderBy: { createdAt: "desc" },
        select: { status: true, coverLetter: true, createdAt: true, updatedAt: true, job: { select: { title: true, city: true } } },
      },
      postedJobs: {
        orderBy: { createdAt: "desc" },
        select: { title: true, description: true, requirements: true, category: true, city: true, status: true, createdAt: true, expiresAt: true },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        select: { plan: true, status: true, requestedReference: true, currentPeriodStart: true, currentPeriodEnd: true, createdAt: true },
      },
    },
  });
  if (!account) fail("Account not found.");
  return { exportedAt: new Date().toISOString(), account };
}

/**
 * Permanently deletes the signed-in user's account and the data that belongs to
 * it (profile, applications, job listings, membership records). Requires the
 * current password, so a hijacked session alone cannot destroy an account.
 */
export async function deleteAccount(actor: Actor | null, input: { password: string; confirmation: string }) {
  if (!actor) fail("Please log in to continue.");
  if (actor.userType === "ADMIN") fail("Administrator accounts cannot be deleted from account settings.");
  await enforceRateLimit(rateLimitKey("account-delete", actor.id), RATE_LIMITS.accountDeletion);
  if (input.confirmation.trim().toUpperCase() !== "DELETE") fail("Type DELETE to confirm.");
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) fail("Your password is incorrect.");
  try {
    await prisma.user.delete({ where: { id: actor.id } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") {
      fail("This account has records from our earlier services marketplace and cannot be deleted automatically. Please contact support.");
    }
    throw error;
  }
}
