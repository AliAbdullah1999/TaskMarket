import { CITIES } from "../constants";
import { prisma } from "../db";
import { fail } from "../errors";
import { hashPassword, verifyPassword } from "../password";
import { isUniqueViolation } from "../transactions";
import type { Actor } from "./jobs";

export const PHONE_PATTERN = /^(\+92|0)3\d{9}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(value: string) {
  return value.replace(/[\s-]/g, "");
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    fail("Password must be 8–128 characters and include a letter and a number.");
  }
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
  validatePassword(input.password);
  if (userType === "EMPLOYER" && (businessName.length < 2 || businessName.length > 120)) {
    fail("Enter your company name (2–120 characters).");
  }

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
        candidateProfile: userType === "CANDIDATE" ? { create: { skills: [] } } : undefined,
        employerProfile: userType === "EMPLOYER" ? { create: { companyName: businessName } } : undefined,
      },
      select: { id: true, userType: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) fail("An account with this email already exists. Log in instead.");
    throw error;
  }
}

// Compared against when the email is unknown, so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;

/** Verifies credentials and account status. Every credential failure returns the same message. */
export async function authenticate(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  if (!email || !password || email.length > 254 || password.length > 128) fail("Incorrect email or password.");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, status: true } });
  if (!user) {
    dummyHash ??= hashPassword("connect-hr-timing-equaliser-1");
    await verifyPassword(password, await dummyHash);
    fail("Incorrect email or password.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) fail("Incorrect email or password.");
  if (user.status === "SUSPENDED" || user.status === "BANNED") fail("This account has been suspended. Contact support for help.");
  return { id: user.id };
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

export async function changePassword(actor: Actor | null, input: { currentPassword: string; newPassword: string }) {
  if (!actor) fail("Please log in to continue.");
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) fail("Your current password is incorrect.");
  validatePassword(input.newPassword);
  if (input.currentPassword === input.newPassword) fail("Choose a new password that is different from your current one.");
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
}
