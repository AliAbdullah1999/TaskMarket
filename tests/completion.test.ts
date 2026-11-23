import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { testOutbox } from "../lib/email";
import { publicJobWhere } from "../lib/entitlements";
import { authenticate, exportAccountData, registerUser } from "../lib/services/accounts";
import { submitApplication, updateApplicationStatusForEmployer } from "../lib/services/applications";
import { getOpenInvitationsForCandidate, inviteCandidateToJob } from "../lib/services/invitations";
import { createJobForEmployer, updateJobForEmployer } from "../lib/services/jobs";
import { runDailyMaintenance } from "../lib/services/maintenance";
import { requestMembership, reviewMembershipRequest, setAccountStatus } from "../lib/services/memberships";
import { removeJobAsAdmin } from "../lib/services/moderation";
import {
  hashToken,
  isPasswordResetTokenValid,
  requestPasswordReset,
  resendVerification,
  resetPasswordWithToken,
  sendVerificationEmail,
  verifyEmailWithToken,
} from "../lib/services/recovery";
import { addDays } from "../lib/time";
import { activateMembership, createJob, createUser, prisma, rejectsWith, resetDb, validJobInput } from "./helpers";

beforeEach(async () => {
  await resetDb();
  testOutbox.length = 0;
});
after(() => prisma.$disconnect());

const base = {
  fullName: "Ayesha Khan",
  email: "ayesha@example.com",
  phone: "03001234567",
  city: "Karachi",
  password: "correct-horse-7",
  userType: "CANDIDATE",
  businessName: "",
  acceptTerms: true,
};

/** The token inside the most recent emailed link to `to`. */
function tokenFromEmail(to: string) {
  const message = testOutbox.findLast((item) => item.to === to);
  assert.ok(message, `expected an email to ${to}`);
  const token = message.text.match(/token=([\w-]+)/)?.[1];
  assert.ok(token, "expected a link with a token");
  return token;
}

async function candidateWithPublicProfile(name = "Sara Malik") {
  const user = await createUser("CANDIDATE", { fullName: name });
  const profile = await prisma.candidateProfile.update({
    where: { userId: user.id },
    data: { isPublic: true, headline: "Accountant", skills: ["Excel"], skillsNormalized: ["excel"] },
  });
  return { user, profile };
}

describe("email verification", () => {
  test("new accounts start unverified and the emailed link verifies them", async () => {
    const user = await registerUser(base);
    await sendVerificationEmail(user.id);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt, null);
    const token = tokenFromEmail(base.email);
    assert.equal(await verifyEmailWithToken(token), true);
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt);
    // Opening the same link again still reports success; a made-up link does not.
    assert.equal(await verifyEmailWithToken(token), true);
    assert.equal(await verifyEmailWithToken("not-a-real-token"), false);
  });

  test("only a hash of the token is stored, and links expire", async () => {
    const user = await registerUser(base);
    await sendVerificationEmail(user.id);
    const token = tokenFromEmail(base.email);
    const stored = await prisma.authToken.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(stored.tokenHash, hashToken(token));
    assert.notEqual(stored.tokenHash, token);
    assert.equal(await verifyEmailWithToken(token, addDays(new Date(), 3)), false);
  });

  test("a reset link cannot be used as a verification link", async () => {
    await registerUser(base);
    await requestPasswordReset(base.email);
    assert.equal(await verifyEmailWithToken(tokenFromEmail(base.email)), false);
  });

  test("unverified candidates cannot apply and unverified employers cannot publish", async () => {
    const candidate = await createUser("CANDIDATE", { verified: false });
    const employer = await createUser("EMPLOYER");
    const job = await createJob(employer.id);
    await rejectsWith(submitApplication(candidate, { jobId: job.id, coverLetter: "" }), /confirm your email/);
    const newEmployer = await createUser("EMPLOYER", { verified: false });
    await rejectsWith(createJobForEmployer(newEmployer, validJobInput()), /confirm your email/);
    assert.equal(await prisma.jobApplication.count(), 0);
  });

  test("resending is throttled and refused once verified", async () => {
    const user = await createUser("CANDIDATE", { verified: false });
    for (let i = 0; i < 3; i += 1) await resendVerification(user);
    await rejectsWith(resendVerification(user), /Too many attempts/);
    assert.equal(testOutbox.length, 3);
    // Each resend replaces the previous link.
    assert.equal(await prisma.authToken.count({ where: { userId: user.id } }), 1);
    const verified = await createUser("CANDIDATE");
    await rejectsWith(resendVerification(verified), /already confirmed/);
  });
});

describe("password reset", () => {
  test("the emailed link sets a new password, once, and signs out every session", async () => {
    const user = await registerUser(base);
    await requestPasswordReset("  AYESHA@example.com ");
    const token = tokenFromEmail(base.email);
    assert.equal(await isPasswordResetTokenValid(token), true);
    await resetPasswordWithToken({ token, newPassword: "brand-new-pass-9" });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updated.sessionVersion, user.sessionVersion + 1);
    assert.ok(updated.emailVerifiedAt, "using the emailed link proves the address");
    await authenticate(base.email, "brand-new-pass-9");
    await rejectsWith(authenticate(base.email, base.password), /Incorrect email or password/);
    assert.equal(await isPasswordResetTokenValid(token), false);
    await rejectsWith(resetPasswordWithToken({ token, newPassword: "another-pass-10" }), /invalid or has expired/);
  });

  test("unknown and suspended accounts get no email, with no error either way", async () => {
    await requestPasswordReset("nobody@example.com");
    const suspended = await createUser("CANDIDATE", { status: "SUSPENDED" });
    await requestPasswordReset(suspended.email);
    assert.equal(testOutbox.length, 0);
  });

  test("links expire after an hour and weak passwords are rejected without using the link", async () => {
    await registerUser(base);
    await requestPasswordReset(base.email);
    const token = tokenFromEmail(base.email);
    await rejectsWith(resetPasswordWithToken({ token, newPassword: "short1" }), /Password must be/);
    assert.equal(await isPasswordResetTokenValid(token), true);
    const later = new Date(Date.now() + 61 * 60 * 1000);
    await rejectsWith(resetPasswordWithToken({ token, newPassword: "brand-new-pass-9" }, later), /invalid or has expired/);
  });

  test("a reset clears the sign-in lockout", async () => {
    await registerUser(base);
    for (let i = 0; i < 5; i += 1) await rejectsWith(authenticate(base.email, `wrong-pass-${i}`), /Incorrect/);
    await rejectsWith(authenticate(base.email, base.password), /Too many attempts/);
    await requestPasswordReset(base.email);
    await resetPasswordWithToken({ token: tokenFromEmail(base.email), newPassword: "brand-new-pass-9" });
    await authenticate(base.email, "brand-new-pass-9");
  });

  test("requests are throttled per address without revealing it, and per network address", async () => {
    await registerUser(base);
    for (let i = 0; i < 5; i += 1) await requestPasswordReset(base.email);
    assert.equal(testOutbox.length, 3);
    for (let i = 0; i < 10; i += 1) await requestPasswordReset(`someone${i}@example.com`, { ip: "203.0.113.9" });
    await rejectsWith(requestPasswordReset("one-more@example.com", { ip: "203.0.113.9" }), /Too many attempts/);
  });
});

describe("notifications", () => {
  test("employers hear about new applications and candidates about status changes", async () => {
    const candidate = await createUser("CANDIDATE");
    const employer = await createUser("EMPLOYER");
    const job = await createJob(employer.id, { title: "Payroll Officer (Lahore)" });
    const application = await submitApplication(candidate, { jobId: job.id, coverLetter: "" });
    assert.equal(testOutbox.length, 1);
    assert.equal(testOutbox[0].to, employer.email);
    assert.match(testOutbox[0].subject, /New application for Payroll Officer/);
    assert.ok(!testOutbox[0].text.includes(candidate.email), "the candidate's address stays inside the app");

    await updateApplicationStatusForEmployer(employer, { applicationId: application.id, status: "SHORTLISTED" });
    assert.equal(testOutbox.length, 2);
    assert.equal(testOutbox[1].to, candidate.email);
    assert.match(testOutbox[1].text, /New status: Shortlisted/);
    // Saving the same status again sends nothing.
    await updateApplicationStatusForEmployer(employer, { applicationId: application.id, status: "SHORTLISTED" });
    assert.equal(testOutbox.length, 2);
  });

  test("members are emailed when a request is approved or rejected", async () => {
    const admin = await createUser("ADMIN");
    const employer = await createUser("EMPLOYER");
    const candidate = await createUser("CANDIDATE");
    const first = await requestMembership(employer, { plan: "EMPLOYER_GROWTH", reference: "IBFT-1" });
    await reviewMembershipRequest(admin, { subscriptionId: first.id, decision: "approve", paymentReference: "IBFT-1", note: "" });
    const second = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" });
    await reviewMembershipRequest(admin, { subscriptionId: second.id, decision: "reject", paymentReference: "", note: "Payment not received" });
    assert.deepEqual(testOutbox.map((item) => item.to), [employer.email, candidate.email]);
    assert.match(testOutbox[0].subject, /Employer Growth membership is active/);
    assert.match(testOutbox[1].text, /Reason: Payment not received/);
  });
});

describe("moderation", () => {
  test("jobs of a suspended employer leave public listings and stop accepting applications", async () => {
    const admin = await createUser("ADMIN");
    const employer = await createUser("EMPLOYER");
    const candidate = await createUser("CANDIDATE");
    const job = await createJob(employer.id);
    assert.equal(await prisma.job.count({ where: publicJobWhere(new Date()) }), 1);
    await setAccountStatus(admin, { userId: employer.id, status: "SUSPENDED" });
    assert.equal(await prisma.job.count({ where: publicJobWhere(new Date()) }), 0);
    await rejectsWith(submitApplication(candidate, { jobId: job.id, coverLetter: "" }), /no longer accepting/);
    await setAccountStatus(admin, { userId: employer.id, status: "ACTIVE" });
    assert.equal(await prisma.job.count({ where: publicJobWhere(new Date()) }), 1);
  });

  test("an admin can remove a listing, with a reason, an audit entry and an email", async () => {
    const admin = await createUser("ADMIN");
    const employer = await createUser("EMPLOYER");
    const candidate = await createUser("CANDIDATE");
    const job = await createJob(employer.id, { title: "Suspicious Data Entry Job" });
    await rejectsWith(removeJobAsAdmin(admin, { jobId: job.id, reason: "x" }), /reason for removal/);
    await removeJobAsAdmin(admin, { jobId: job.id, reason: "Asks candidates to pay a registration fee." });

    const removed = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(removed.status, "ARCHIVED");
    assert.match(removed.removedReason ?? "", /registration fee/);
    assert.equal(await prisma.job.count({ where: publicJobWhere(new Date()) }), 0);
    await rejectsWith(submitApplication(candidate, { jobId: job.id, coverLetter: "" }), /no longer accepting/);
    await rejectsWith(updateJobForEmployer(employer, job.id, validJobInput()), /not found/);
    await rejectsWith(removeJobAsAdmin(admin, { jobId: job.id, reason: "Second attempt at removal" }), /already been removed/);

    const audit = await prisma.adminAuditLog.findFirstOrThrow({ where: { action: "JOB_REMOVED" } });
    assert.equal(audit.targetId, job.id);
    assert.equal(testOutbox.at(-1)?.to, employer.email);
    assert.match(testOutbox.at(-1)?.text ?? "", /registration fee/);
  });

  test("a removed listing frees the employer's active job slot", async () => {
    const admin = await createUser("ADMIN");
    const employer = await createUser("EMPLOYER");
    const first = await createJobForEmployer(employer, validJobInput());
    await rejectsWith(createJobForEmployer(employer, validJobInput()), /allows 1 active job/);
    await removeJobAsAdmin(admin, { jobId: first.id, reason: "Duplicate of another listing." });
    await createJobForEmployer(employer, validJobInput());
  });

  test("only admins can remove listings", async () => {
    const employer = await createUser("EMPLOYER");
    const job = await createJob(employer.id);
    await rejectsWith(removeJobAsAdmin(employer, { jobId: job.id, reason: "I would like this gone" }), /Admin access required/);
    await rejectsWith(removeJobAsAdmin(null, { jobId: job.id, reason: "I would like this gone" }), /Admin access required/);
    assert.equal((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status, "OPEN");
  });
});

describe("candidate invitations", () => {
  async function growthEmployer() {
    const employer = await createUser("EMPLOYER");
    await activateMembership(employer.id, "EMPLOYER_GROWTH");
    const job = await createJob(employer.id, { title: "Finance Manager (Karachi)" });
    return { employer, job };
  }

  test("a Growth employer can invite a searchable candidate, who is emailed without exposing their address", async () => {
    const { employer, job } = await growthEmployer();
    const { user, profile } = await candidateWithPublicProfile();
    await inviteCandidateToJob(employer, { profileId: profile.id, jobId: job.id, message: "Your profile is a great fit." });

    assert.equal(testOutbox.length, 1);
    assert.equal(testOutbox[0].to, user.email);
    assert.match(testOutbox[0].text, /Your profile is a great fit\./);
    assert.match(testOutbox[0].text, new RegExp(`/jobs/${job.id}`));
    const open = await getOpenInvitationsForCandidate(user.id);
    assert.equal(open.length, 1);
    assert.equal(open[0].job.id, job.id);

    await rejectsWith(inviteCandidateToJob(employer, { profileId: profile.id, jobId: job.id, message: "" }), /already invited/);
    // Once the candidate applies, the invitation is no longer pending.
    await submitApplication(user, { jobId: job.id, coverLetter: "" });
    assert.equal((await getOpenInvitationsForCandidate(user.id)).length, 0);
  });

  test("invitations need Growth, a verified email and the employer's own open job", async () => {
    const { employer, job } = await growthEmployer();
    const { profile } = await candidateWithPublicProfile();
    const free = await createUser("EMPLOYER");
    const freeJob = await createJob(free.id);
    await rejectsWith(inviteCandidateToJob(free, { profileId: profile.id, jobId: freeJob.id, message: "" }), /Employer Growth/);
    await rejectsWith(inviteCandidateToJob(employer, { profileId: profile.id, jobId: freeJob.id, message: "" }), /your own job/);
    const closed = await createJob(employer.id, { status: "CLOSED" });
    await rejectsWith(inviteCandidateToJob(employer, { profileId: profile.id, jobId: closed.id, message: "" }), /no longer accepting/);
    await rejectsWith(inviteCandidateToJob(employer, { profileId: profile.id, jobId: job.id, message: "x".repeat(501) }), /500 characters/);

    const unverified = await createUser("EMPLOYER", { verified: false });
    await activateMembership(unverified.id, "EMPLOYER_GROWTH");
    const unverifiedJob = await createJob(unverified.id);
    await rejectsWith(inviteCandidateToJob(unverified, { profileId: profile.id, jobId: unverifiedJob.id, message: "" }), /confirm your email/);

    const candidate = await createUser("CANDIDATE");
    await rejectsWith(inviteCandidateToJob(candidate, { profileId: profile.id, jobId: job.id, message: "" }), /Only employer accounts/);
    assert.equal(await prisma.jobInvitation.count(), 0);
    assert.equal(testOutbox.length, 0);
  });

  test("private profiles, suspended candidates and existing applicants cannot be invited", async () => {
    const { employer, job } = await growthEmployer();
    const hidden = await createUser("CANDIDATE");
    const hiddenProfile = await prisma.candidateProfile.findUniqueOrThrow({ where: { userId: hidden.id } });
    await rejectsWith(inviteCandidateToJob(employer, { profileId: hiddenProfile.id, jobId: job.id, message: "" }), /no longer available/);

    const { user: suspended, profile: suspendedProfile } = await candidateWithPublicProfile("Suspended Person");
    await prisma.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } });
    await rejectsWith(inviteCandidateToJob(employer, { profileId: suspendedProfile.id, jobId: job.id, message: "" }), /no longer available/);

    const { user: applicant, profile: applicantProfile } = await candidateWithPublicProfile("Already Applied");
    await submitApplication(applicant, { jobId: job.id, coverLetter: "" });
    await rejectsWith(inviteCandidateToJob(employer, { profileId: applicantProfile.id, jobId: job.id, message: "" }), /already applied/);
  });

  test("invitations appear in the data export and are deleted with the account", async () => {
    const { employer, job } = await growthEmployer();
    const { user, profile } = await candidateWithPublicProfile();
    await inviteCandidateToJob(employer, { profileId: profile.id, jobId: job.id, message: "Hello there" });
    const exported = await exportAccountData(user);
    assert.equal(exported.account.invitationsReceived.length, 1);
    assert.equal(exported.account.invitationsReceived[0].message, "Hello there");
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal(await prisma.jobInvitation.count(), 0);
  });
});

describe("daily maintenance", () => {
  test("sends one renewal reminder inside the renewal window, and none when a renewal is pending", async () => {
    const now = new Date();
    const dueSoon = await createUser("EMPLOYER");
    await activateMembership(dueSoon.id, "EMPLOYER_GROWTH", { start: addDays(now, -27), end: addDays(now, 3) });
    const notYet = await createUser("EMPLOYER");
    await activateMembership(notYet.id, "EMPLOYER_GROWTH", { start: addDays(now, -5), end: addDays(now, 25) });
    const renewing = await createUser("CANDIDATE");
    await activateMembership(renewing.id, "CANDIDATE_PRO", { start: addDays(now, -27), end: addDays(now, 3) });
    await requestMembership(renewing, { plan: "CANDIDATE_PRO", reference: "" }, now);

    const first = await runDailyMaintenance(now);
    assert.equal(first.renewalReminders, 1);
    assert.deepEqual(testOutbox.map((item) => item.to), [dueSoon.email]);
    assert.match(testOutbox[0].subject, /Employer Growth membership ends on/);
    const second = await runDailyMaintenance(now);
    assert.equal(second.renewalReminders, 0);
    assert.equal(testOutbox.length, 1);
  });

  test("marks lapsed memberships expired and removes expired links", async () => {
    const now = new Date();
    const member = await createUser("EMPLOYER");
    const membership = await activateMembership(member.id, "EMPLOYER_GROWTH", { start: addDays(now, -31), end: addDays(now, -1) });
    const user = await registerUser(base);
    await sendVerificationEmail(user.id, addDays(now, -5));
    const result = await runDailyMaintenance(now);
    assert.equal(result.expiredMemberships, 1);
    assert.equal(result.purgedTokens, 1);
    assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: membership.id } })).status, "EXPIRED");
  });
});
