import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { getCandidateApplicationAllowance } from "../lib/entitlements";
import { ActionError } from "../lib/errors";
import { submitApplication, updateApplicationStatusForEmployer } from "../lib/services/applications";
import { addDays, pktMonthStart } from "../lib/time";
import { activateMembership, createJob, createUser, prisma, rejectsWith, resetDb } from "./helpers";

beforeEach(resetDb);
after(() => prisma.$disconnect());

async function setup(jobCount = 1) {
  const candidate = await createUser("CANDIDATE");
  const employer = await createUser("EMPLOYER");
  const jobs = [];
  for (let i = 0; i < jobCount; i += 1) jobs.push(await createJob(employer.id, { title: `Open role number ${i + 1}` }));
  return { candidate, employer, jobs };
}

describe("submitting applications", () => {
  test("a candidate can apply to an open job with an optional cover letter", async () => {
    const { candidate, employer, jobs } = await setup();
    await submitApplication(candidate, { jobId: jobs[0].id, coverLetter: "I would love to join." });
    const application = await prisma.jobApplication.findFirstOrThrow({ where: { candidateId: candidate.id } });
    assert.equal(application.status, "SUBMITTED");
    assert.equal(application.employerId, employer.id);
    assert.equal(application.coverLetter, "I would love to join.");
  });

  test("duplicate applications are prevented", async () => {
    const { candidate, jobs } = await setup();
    await submitApplication(candidate, { jobId: jobs[0].id, coverLetter: "" });
    await rejectsWith(submitApplication(candidate, { jobId: jobs[0].id, coverLetter: "" }), /already applied/);
  });

  test("concurrent duplicate submissions create exactly one application", async () => {
    const { candidate, jobs } = await setup();
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => submitApplication(candidate, { jobId: jobs[0].id, coverLetter: "" })),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await prisma.jobApplication.count(), 1);
  });

  test("closed and expired jobs do not accept applications", async () => {
    const { candidate, employer } = await setup(0);
    const closed = await createJob(employer.id, { status: "CLOSED" });
    const expired = await createJob(employer.id, { expiresAt: addDays(new Date(), -1) });
    await rejectsWith(submitApplication(candidate, { jobId: closed.id, coverLetter: "" }), /no longer accepting/);
    await rejectsWith(submitApplication(candidate, { jobId: expired.id, coverLetter: "" }), /no longer accepting/);
    await rejectsWith(submitApplication(candidate, { jobId: "missing", coverLetter: "" }), /could not be found/);
  });

  test("only candidates can apply", async () => {
    const { employer, jobs } = await setup();
    const admin = await createUser("ADMIN");
    await rejectsWith(submitApplication(employer, { jobId: jobs[0].id, coverLetter: "" }), /Only candidate/);
    await rejectsWith(submitApplication(admin, { jobId: jobs[0].id, coverLetter: "" }), /Only candidate/);
    await rejectsWith(submitApplication(null, { jobId: jobs[0].id, coverLetter: "" }), /log in/);
  });
});

describe("monthly application limit", () => {
  test("free candidates are limited to 3 applications per calendar month", async () => {
    const { candidate, jobs } = await setup(4);
    for (const job of jobs.slice(0, 3)) await submitApplication(candidate, { jobId: job.id, coverLetter: "" });
    await rejectsWith(submitApplication(candidate, { jobId: jobs[3].id, coverLetter: "" }), /all 3 free applications/);
    const allowance = await getCandidateApplicationAllowance(prisma, candidate.id);
    assert.deepEqual([allowance.used, allowance.remaining, allowance.canApply], [3, 0, false]);
  });

  test("parallel requests cannot bypass the limit", async () => {
    const { candidate, jobs } = await setup(6);
    const results = await Promise.allSettled(jobs.map((job) => submitApplication(candidate, { jobId: job.id, coverLetter: "" })));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    assert.equal(results.length - failures.length, 3);
    for (const failure of failures) assert.ok(failure.reason instanceof ActionError, String(failure.reason));
    assert.equal(await prisma.jobApplication.count({ where: { candidateId: candidate.id } }), 3);
  });

  test("applications from the previous Pakistan-time month do not count", async () => {
    const { candidate, jobs } = await setup(5);
    const lastMonth = new Date(pktMonthStart().getTime() - 60_000);
    for (const job of jobs.slice(0, 3)) {
      await prisma.jobApplication.create({
        data: { jobId: job.id, candidateId: candidate.id, employerId: job.employerId, createdAt: lastMonth },
      });
    }
    await submitApplication(candidate, { jobId: jobs[3].id, coverLetter: "" });
    assert.equal((await getCandidateApplicationAllowance(prisma, candidate.id)).used, 1);
  });

  test("withdrawn applications still count, so the limit cannot be reset", async () => {
    const { candidate, jobs } = await setup(4);
    for (const job of jobs.slice(0, 3)) await submitApplication(candidate, { jobId: job.id, coverLetter: "" });
    await prisma.jobApplication.updateMany({ where: { candidateId: candidate.id }, data: { status: "WITHDRAWN" } });
    await rejectsWith(submitApplication(candidate, { jobId: jobs[3].id, coverLetter: "" }), /free applications/);
  });

  test("active Candidate Pro allows unlimited applications", async () => {
    const { candidate, jobs } = await setup(5);
    await activateMembership(candidate.id, "CANDIDATE_PRO");
    for (const job of jobs) await submitApplication(candidate, { jobId: job.id, coverLetter: "" });
    assert.equal(await prisma.jobApplication.count({ where: { candidateId: candidate.id } }), 5);
  });

  test("expired, pending, future-dated or wrong-plan memberships do not lift the limit", async () => {
    const { candidate, jobs } = await setup(4);
    await activateMembership(candidate.id, "CANDIDATE_PRO", { start: addDays(new Date(), -40), end: addDays(new Date(), -10) });
    await activateMembership(candidate.id, "CANDIDATE_PRO", { start: addDays(new Date(), 5) });
    await activateMembership(candidate.id, "EMPLOYER_GROWTH");
    await prisma.subscription.create({ data: { userId: candidate.id, plan: "CANDIDATE_PRO", status: "REQUESTED" } });
    for (const job of jobs.slice(0, 3)) await submitApplication(candidate, { jobId: job.id, coverLetter: "" });
    await rejectsWith(submitApplication(candidate, { jobId: jobs[3].id, coverLetter: "" }), /free applications/);
  });
});

describe("employer applicant review", () => {
  test("the job owner can move an application through the pipeline", async () => {
    const { candidate, employer, jobs } = await setup();
    const application = await submitApplication(candidate, { jobId: jobs[0].id, coverLetter: "" });
    for (const status of ["REVIEWING", "SHORTLISTED", "HIRED"]) {
      await updateApplicationStatusForEmployer(employer, { applicationId: application.id, status });
      assert.equal((await prisma.jobApplication.findUniqueOrThrow({ where: { id: application.id } })).status, status);
    }
    await rejectsWith(
      updateApplicationStatusForEmployer(employer, { applicationId: application.id, status: "REJECTED" }),
      /finalised/,
    );
  });

  test("another employer cannot see or modify the application", async () => {
    const { candidate, jobs } = await setup();
    const intruder = await createUser("EMPLOYER");
    const application = await submitApplication(candidate, { jobId: jobs[0].id, coverLetter: "" });
    await rejectsWith(updateApplicationStatusForEmployer(intruder, { applicationId: application.id, status: "REJECTED" }), /not found/);
    await rejectsWith(updateApplicationStatusForEmployer(candidate, { applicationId: application.id, status: "HIRED" }), /Only employers/);
    assert.equal((await prisma.jobApplication.findUniqueOrThrow({ where: { id: application.id } })).status, "SUBMITTED");
  });

  test("invalid statuses are rejected", async () => {
    const { candidate, employer, jobs } = await setup();
    const application = await submitApplication(candidate, { jobId: jobs[0].id, coverLetter: "" });
    await rejectsWith(updateApplicationStatusForEmployer(employer, { applicationId: application.id, status: "WITHDRAWN" }), /valid application status/);
    await rejectsWith(updateApplicationStatusForEmployer(employer, { applicationId: application.id, status: "SUBMITTED" }), /valid application status/);
  });
});
