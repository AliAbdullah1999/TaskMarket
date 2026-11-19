import assert from "node:assert/strict";
import type { SubscriptionPlan, UserType } from "@prisma/client";
import { prisma } from "../lib/db";
import { ActionError } from "../lib/errors";
import { addDays } from "../lib/time";

const dbName = new URL(process.env.DATABASE_URL ?? "postgres://x/none").pathname.slice(1);
if (!/test/i.test(dbName)) {
  throw new Error(`Tests must run against a *test* database (got "${dbName}"). Use npm test.`);
}

export { prisma };

/** Empties every application table in the isolated test database. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
}

let counter = 0;
export async function createUser(userType: UserType, overrides: { city?: string; status?: "ACTIVE" | "SUSPENDED"; fullName?: string } = {}) {
  counter += 1;
  return prisma.user.create({
    data: {
      fullName: overrides.fullName ?? `${userType.toLowerCase()} user ${counter}`,
      email: `${userType.toLowerCase()}${counter}-${Date.now()}@test.example`,
      passwordHash: "scrypt$00$00",
      city: overrides.city ?? "Karachi",
      phone: "03001234567",
      userType,
      status: overrides.status ?? "ACTIVE",
      candidateProfile: userType === "CANDIDATE" ? { create: { skills: [] } } : undefined,
      employerProfile: userType === "EMPLOYER" ? { create: { companyName: `Company ${counter}` } } : undefined,
    },
    select: { id: true, userType: true, email: true },
  });
}

export async function createJob(employerId: string, overrides: { status?: "OPEN" | "CLOSED"; expiresAt?: Date | null; title?: string } = {}) {
  return prisma.job.create({
    data: {
      employerId,
      title: overrides.title ?? "Senior Accountant (Finance)",
      description: "A full-time role managing month-end close, reconciliations and reporting for our team.",
      category: "Finance",
      city: "Lahore",
      employmentType: "FULL_TIME",
      workplaceType: "ONSITE",
      status: overrides.status ?? "OPEN",
      expiresAt: overrides.expiresAt === undefined ? addDays(new Date(), 30) : overrides.expiresAt,
    },
  });
}

export async function activateMembership(userId: string, plan: SubscriptionPlan, opts: { start?: Date; end?: Date } = {}) {
  const start = opts.start ?? addDays(new Date(), -1);
  return prisma.subscription.create({
    data: { userId, plan, status: "ACTIVE", currentPeriodStart: start, currentPeriodEnd: opts.end ?? addDays(start, 30) },
  });
}

export function validJobInput(overrides: Partial<Record<string, string | number | null>> = {}) {
  return {
    title: "Frontend Engineer (React)",
    description: "Build and maintain customer-facing web applications using React and TypeScript in a small team.",
    requirements: "2+ years of React experience.",
    category: "Information Technology",
    city: "Karachi",
    employmentType: "FULL_TIME",
    workplaceType: "HYBRID",
    salaryMin: 150000 as number | null,
    salaryMax: 250000 as number | null,
    ...overrides,
  } as {
    title: string;
    description: string;
    requirements: string;
    category: string;
    city: string;
    employmentType: string;
    workplaceType: string;
    salaryMin: number | null;
    salaryMax: number | null;
  };
}

/** Asserts that `promise` rejects with a user-facing ActionError whose message matches. */
export async function rejectsWith(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ActionError, `expected ActionError, got ${error instanceof Error ? error.constructor.name + ": " + error.message : String(error)}`);
    assert.match(error.message, pattern);
    return true;
  });
}
