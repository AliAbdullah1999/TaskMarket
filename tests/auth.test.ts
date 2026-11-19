import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { authenticate, changePassword, registerUser, updateAccountDetails } from "../lib/services/accounts";
import { verifyPassword } from "../lib/password";
import { safeNext } from "../lib/safe-redirect";
import { pktMonthStart, pktNextMonthStart } from "../lib/time";
import { createUser, prisma, rejectsWith, resetDb } from "./helpers";

const base = {
  fullName: "Ayesha Khan",
  email: "Ayesha@Example.com",
  phone: "0300 1234567",
  city: "Lahore",
  password: "secret123",
  userType: "CANDIDATE",
  businessName: "",
};

beforeEach(resetDb);
after(() => prisma.$disconnect());

describe("registration", () => {
  test("registers a candidate with a hashed password and private profile", async () => {
    const user = await registerUser(base);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { candidateProfile: true } });
    assert.equal(stored.userType, "CANDIDATE");
    assert.equal(stored.email, "ayesha@example.com");
    assert.equal(stored.phone, "03001234567");
    assert.notEqual(stored.passwordHash, base.password);
    assert.ok(await verifyPassword(base.password, stored.passwordHash));
    assert.equal(stored.candidateProfile?.isPublic, false);
  });

  test("registers an employer with a company profile", async () => {
    const user = await registerUser({ ...base, email: "hr@acme.pk", userType: "EMPLOYER", businessName: "Acme Pvt Ltd" });
    const profile = await prisma.employerProfile.findUniqueOrThrow({ where: { userId: user.id } });
    assert.equal(profile.companyName, "Acme Pvt Ltd");
  });

  test("rejects duplicate emails case-insensitively", async () => {
    await registerUser(base);
    await rejectsWith(registerUser({ ...base, email: "ayesha@EXAMPLE.com" }), /already exists/);
  });

  test("never allows registering an admin or legacy role", async () => {
    await rejectsWith(registerUser({ ...base, userType: "ADMIN" }), /candidate or employer/);
    await rejectsWith(registerUser({ ...base, userType: "TASKER" }), /candidate or employer/);
  });

  test("validates inputs", async () => {
    await rejectsWith(registerUser({ ...base, password: "short1" }), /Password/);
    await rejectsWith(registerUser({ ...base, password: "lettersonly" }), /Password/);
    await rejectsWith(registerUser({ ...base, phone: "12345" }), /Pakistani mobile/);
    await rejectsWith(registerUser({ ...base, city: "Atlantis" }), /city/);
    await rejectsWith(registerUser({ ...base, email: "not-an-email" }), /valid email/);
    await rejectsWith(registerUser({ ...base, userType: "EMPLOYER", businessName: "" }), /company name/);
  });
});

describe("login", () => {
  test("authenticates valid credentials", async () => {
    const user = await registerUser(base);
    assert.equal((await authenticate("ayesha@example.com", base.password)).id, user.id);
  });

  test("rejects wrong password and unknown email with the same message", async () => {
    await registerUser(base);
    await rejectsWith(authenticate("ayesha@example.com", "wrong1234"), /^Incorrect email or password\.$/);
    await rejectsWith(authenticate("nobody@example.com", base.password), /^Incorrect email or password\.$/);
  });

  test("blocks suspended accounts", async () => {
    const user = await registerUser(base);
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    await rejectsWith(authenticate("ayesha@example.com", base.password), /suspended/);
  });

  test("post-login redirect only allows same-site paths", () => {
    assert.equal(safeNext("/jobs/abc"), "/jobs/abc");
    assert.equal(safeNext("//evil.com"), "/dashboard");
    assert.equal(safeNext("/\\evil.com"), "/dashboard");
    assert.equal(safeNext("https://evil.com"), "/dashboard");
    assert.equal(safeNext(""), "/dashboard");
  });
});

describe("account settings", () => {
  test("updates only the signed-in user's own details", async () => {
    const me = await createUser("CANDIDATE");
    const other = await createUser("CANDIDATE", { fullName: "Other Person" });
    await updateAccountDetails(me, { fullName: "New Name", city: "Multan", phone: "" });
    const [mine, theirs] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: me.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: other.id } }),
    ]);
    assert.equal(mine.fullName, "New Name");
    assert.equal(mine.city, "Multan");
    assert.equal(mine.phone, null);
    assert.equal(theirs.fullName, "Other Person");
  });

  test("changing password requires the current password", async () => {
    const user = await registerUser(base);
    const actor = { id: user.id, userType: user.userType };
    await rejectsWith(changePassword(actor, { currentPassword: "wrong1234", newPassword: "newpass123" }), /current password/);
    await changePassword(actor, { currentPassword: base.password, newPassword: "newpass123" });
    await authenticate("ayesha@example.com", "newpass123");
  });

  test("anonymous calls are rejected", async () => {
    await rejectsWith(updateAccountDetails(null, { fullName: "X Y", city: "Lahore", phone: "" }), /log in/);
  });
});

describe("Pakistan-time month boundaries", () => {
  test("a moment just after midnight PKT on 1 Nov belongs to November", () => {
    const justAfter = new Date("2026-10-31T19:30:00Z"); // 00:30 PKT, 1 Nov
    assert.equal(pktMonthStart(justAfter).toISOString(), "2026-10-31T19:00:00.000Z");
    assert.equal(pktNextMonthStart(justAfter).toISOString(), "2026-11-30T19:00:00.000Z");
  });

  test("a moment just before midnight PKT on 31 Oct belongs to October", () => {
    const justBefore = new Date("2026-10-31T18:59:00Z"); // 23:59 PKT, 31 Oct
    assert.equal(pktMonthStart(justBefore).toISOString(), "2026-09-30T19:00:00.000Z");
  });
});
