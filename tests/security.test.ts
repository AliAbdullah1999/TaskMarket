import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { RATE_LIMITS, consumeRateLimit, purgeExpiredRateLimits, rateLimitKey } from "../lib/rate-limit";
import {
  authenticate,
  changePassword,
  deleteAccount,
  exportAccountData,
  registerUser,
  signOutEverywhere,
} from "../lib/services/accounts";
import { submitApplication } from "../lib/services/applications";
import { createJob, createUser, prisma, rejectsWith, resetDb } from "./helpers";

const base = {
  fullName: "Bilal Ahmed",
  email: "bilal@example.com",
  phone: "",
  city: "Karachi",
  password: "correct-horse-7",
  userType: "CANDIDATE",
  businessName: "",
  acceptTerms: true,
};

beforeEach(resetDb);
after(() => prisma.$disconnect());

describe("sign-in throttling", () => {
  test("five wrong passwords lock the account, even for the correct password", async () => {
    await registerUser(base);
    for (let i = 0; i < 5; i += 1) await rejectsWith(authenticate(base.email, "wrong-pass-1"), /Incorrect email or password/);
    await rejectsWith(authenticate(base.email, "wrong-pass-1"), /Too many attempts/);
    await rejectsWith(authenticate(base.email, base.password), /Too many attempts/);
  });

  test("the lock expires after the window", async () => {
    await registerUser(base);
    for (let i = 0; i < 5; i += 1) await rejectsWith(authenticate(base.email, "wrong-pass-1"), /Incorrect/);
    await prisma.rateLimit.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.ok((await authenticate(base.email, base.password)).id);
  });

  test("a successful sign-in clears earlier failures", async () => {
    await registerUser(base);
    for (let i = 0; i < 4; i += 1) await rejectsWith(authenticate(base.email, "wrong-pass-1"), /Incorrect/);
    await authenticate(base.email, base.password);
    for (let i = 0; i < 4; i += 1) await rejectsWith(authenticate(base.email, "wrong-pass-1"), /Incorrect/);
    await authenticate(base.email, base.password);
  });

  test("unknown emails lock the same way, so lockouts do not reveal which accounts exist", async () => {
    for (let i = 0; i < 5; i += 1) await rejectsWith(authenticate("ghost@example.com", "whatever-1"), /Incorrect email or password/);
    await rejectsWith(authenticate("ghost@example.com", "whatever-1"), /Too many attempts/);
  });

  test("one network address cannot spray passwords across many accounts", async () => {
    const limit = RATE_LIMITS.loginPerIp.limit;
    for (let i = 0; i < limit; i += 1) await rejectsWith(authenticate(`user${i}@example.com`, "guess-123", { ip: "203.0.113.9" }), /Incorrect/);
    await rejectsWith(authenticate("another@example.com", "guess-123", { ip: "203.0.113.9" }), /Too many attempts/);
    await rejectsWith(authenticate("another@example.com", "guess-123", { ip: "198.51.100.4" }), /Incorrect/);
  });

  test("sign-ups are limited per network address", async () => {
    for (let i = 0; i < RATE_LIMITS.signupPerIp.limit; i += 1) await registerUser({ ...base, email: `new${i}@example.com`, ip: "203.0.113.20" });
    await rejectsWith(registerUser({ ...base, email: "onemore@example.com", ip: "203.0.113.20" }), /Too many attempts/);
  });

  test("rate-limit keys never store the raw email or address", async () => {
    await rejectsWith(authenticate("secret.person@example.com", "nope-1234", { ip: "203.0.113.77" }), /Incorrect/);
    const rows = await prisma.rateLimit.findMany();
    assert.ok(rows.length >= 2);
    for (const row of rows) assert.ok(!row.key.includes("secret.person") && !row.key.includes("203.0.113.77"), row.key);
  });

  test("counters are atomic under concurrency and can be purged", async () => {
    const key = rateLimitKey("test", "concurrent");
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeRateLimit(key, { limit: 3, windowSeconds: 60 })));
    assert.equal(results.filter((r) => r.allowed).length, 3);
    // The window must be 60 seconds in UTC terms, whatever time zone the database session uses.
    for (const result of results) assert.ok(result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 60, String(result.retryAfterSeconds));
    const stored = await prisma.rateLimit.findUniqueOrThrow({ where: { key } });
    assert.ok(Math.abs(stored.expiresAt.getTime() - Date.now() - 60_000) < 5_000);
    await purgeExpiredRateLimits(new Date(Date.now() + 120_000));
    assert.equal(await prisma.rateLimit.count(), 0);
  });
});

describe("passwords and consent", () => {
  test("common passwords and passwords containing the email are rejected", async () => {
    await rejectsWith(registerUser({ ...base, password: "password123" }), /too common/);
    await rejectsWith(registerUser({ ...base, password: "Pakistan123" }), /too common/);
    await rejectsWith(registerUser({ ...base, password: "bilal-2026" }), /should not contain your email/);
  });

  test("registration requires accepting the terms and records when", async () => {
    await rejectsWith(registerUser({ ...base, acceptTerms: false }), /accept the Terms/);
    const user = await registerUser(base);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.ok(stored.termsAcceptedAt instanceof Date);
  });
});

describe("session revocation", () => {
  test("changing the password bumps the session version", async () => {
    const user = await registerUser(base);
    assert.equal(user.sessionVersion, 0);
    const version = await changePassword(user, { currentPassword: base.password, newPassword: "another-good-9" });
    assert.equal(version, 1);
    assert.equal((await authenticate(base.email, "another-good-9")).sessionVersion, 1);
  });

  test("sign out everywhere bumps the session version", async () => {
    const user = await registerUser(base);
    await signOutEverywhere(user);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, 1);
  });

  test("password-change attempts are throttled", async () => {
    const user = await registerUser(base);
    for (let i = 0; i < RATE_LIMITS.passwordChange.limit; i += 1) {
      await rejectsWith(changePassword(user, { currentPassword: "wrong-one-1", newPassword: "another-good-9" }), /current password/);
    }
    await rejectsWith(changePassword(user, { currentPassword: base.password, newPassword: "another-good-9" }), /Too many attempts/);
  });
});

describe("data rights", () => {
  test("export contains the user's own data and never the password hash", async () => {
    const user = await registerUser(base);
    const employer = await createUser("EMPLOYER");
    const job = await createJob(employer.id);
    await submitApplication(user, { jobId: job.id, coverLetter: "Hello there" });
    const data = await exportAccountData(user);
    const json = JSON.stringify(data);
    assert.equal(data.account.email, base.email);
    assert.equal(data.account.applications.length, 1);
    assert.equal(data.account.applications[0].coverLetter, "Hello there");
    assert.ok(!json.includes("passwordHash") && !json.includes("scrypt$"));
    await rejectsWith(exportAccountData(null), /log in/);
  });

  test("deleting an account needs the password and the typed confirmation", async () => {
    const user = await registerUser(base);
    await rejectsWith(deleteAccount(user, { password: "wrong-pass-1", confirmation: "DELETE" }), /password is incorrect/);
    await rejectsWith(deleteAccount(user, { password: base.password, confirmation: "yes" }), /Type DELETE/);
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 1);
  });

  test("deleting a candidate removes their profile and applications only", async () => {
    const user = await registerUser(base);
    const employer = await createUser("EMPLOYER");
    const job = await createJob(employer.id);
    await submitApplication(user, { jobId: job.id, coverLetter: "" });
    await deleteAccount(user, { password: base.password, confirmation: "delete" });
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 0);
    assert.equal(await prisma.candidateProfile.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma.jobApplication.count(), 0);
    assert.equal(await prisma.job.count({ where: { id: job.id } }), 1);
  });

  test("admins and anonymous callers cannot use account deletion", async () => {
    const admin = await createUser("ADMIN");
    await rejectsWith(deleteAccount(admin, { password: "x", confirmation: "DELETE" }), /Administrator accounts/);
    await rejectsWith(deleteAccount(null, { password: "x", confirmation: "DELETE" }), /log in/);
  });
});

describe("database access control", () => {
  test("row level security is enabled on every application table", async () => {
    const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname <> '_prisma_migrations'`;
    assert.ok(rows.length >= 15);
    assert.deepEqual(rows.filter((row) => !row.relrowsecurity).map((row) => row.relname), []);
  });
});
