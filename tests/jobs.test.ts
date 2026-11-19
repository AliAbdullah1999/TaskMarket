import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { getEmployerJobAllowance } from "../lib/entitlements";
import { closeJobForEmployer, createJobForEmployer, updateJobForEmployer } from "../lib/services/jobs";
import { addDays } from "../lib/time";
import { activateMembership, createJob, createUser, prisma, rejectsWith, resetDb, validJobInput } from "./helpers";

beforeEach(resetDb);
after(() => prisma.$disconnect());

describe("creating jobs", () => {
  test("an employer can publish a job that expires after 30 days", async () => {
    const employer = await createUser("EMPLOYER");
    const now = new Date("2026-11-17T10:00:00Z");
    const { id } = await createJobForEmployer(employer, validJobInput(), now);
    const job = await prisma.job.findUniqueOrThrow({ where: { id } });
    assert.equal(job.status, "OPEN");
    assert.equal(job.employerId, employer.id);
    assert.equal(job.expiresAt?.toISOString(), "2026-12-17T10:00:00.000Z");
  });

  test("only employers can publish", async () => {
    const candidate = await createUser("CANDIDATE");
    await rejectsWith(createJobForEmployer(candidate, validJobInput()), /Only employer/);
    await rejectsWith(createJobForEmployer(null, validJobInput()), /log in/);
  });

  test("validates job fields and salary range", async () => {
    const employer = await createUser("EMPLOYER");
    await rejectsWith(createJobForEmployer(employer, validJobInput({ salaryMin: 300000, salaryMax: 100000 })), /Minimum salary/);
    await rejectsWith(createJobForEmployer(employer, validJobInput({ salaryMin: Number.NaN })), /whole-number/);
    await rejectsWith(createJobForEmployer(employer, validJobInput({ category: "Plumbing" })), /category/);
    await rejectsWith(createJobForEmployer(employer, validJobInput({ employmentType: "GIG" })), /employment type/);
    await rejectsWith(createJobForEmployer(employer, validJobInput({ description: "Too short" })), /description/);
    await createJobForEmployer(employer, validJobInput({ salaryMin: null, salaryMax: null }));
  });
});

describe("active job limits", () => {
  test("free employers may have 1 active job", async () => {
    const employer = await createUser("EMPLOYER");
    await createJobForEmployer(employer, validJobInput());
    await rejectsWith(createJobForEmployer(employer, validJobInput()), /allows 1 active job/);
  });

  test("closed and expired jobs free up the slot", async () => {
    const employer = await createUser("EMPLOYER");
    await createJob(employer.id, { status: "CLOSED" });
    await createJob(employer.id, { expiresAt: addDays(new Date(), -1) });
    await createJobForEmployer(employer, validJobInput());
    assert.equal((await getEmployerJobAllowance(prisma, employer.id)).active, 1);
  });

  test("Growth employers may have 5 active jobs", async () => {
    const employer = await createUser("EMPLOYER");
    await activateMembership(employer.id, "EMPLOYER_GROWTH");
    for (let i = 0; i < 5; i += 1) await createJobForEmployer(employer, validJobInput());
    await rejectsWith(createJobForEmployer(employer, validJobInput()), /allows 5 active jobs/);
  });

  test("an expired Growth membership falls back to the free limit", async () => {
    const employer = await createUser("EMPLOYER");
    await activateMembership(employer.id, "EMPLOYER_GROWTH", { start: addDays(new Date(), -31), end: addDays(new Date(), -1) });
    await createJobForEmployer(employer, validJobInput());
    await rejectsWith(createJobForEmployer(employer, validJobInput()), /allows 1 active job/);
  });

  test("parallel publishing cannot bypass the limit", async () => {
    const employer = await createUser("EMPLOYER");
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => createJobForEmployer(employer, validJobInput())));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await prisma.job.count({ where: { employerId: employer.id } }), 1);
  });
});

describe("editing and closing jobs", () => {
  test("the owner can edit content without changing status or expiry", async () => {
    const employer = await createUser("EMPLOYER");
    const job = await createJob(employer.id);
    await updateJobForEmployer(employer, job.id, validJobInput({ title: "Updated role title here", salaryMin: null, salaryMax: null }));
    const updated = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(updated.title, "Updated role title here");
    assert.equal(updated.salaryMax, null);
    assert.equal(updated.status, "OPEN");
    assert.equal(updated.expiresAt?.getTime(), job.expiresAt?.getTime());
  });

  test("another employer cannot edit or close the job", async () => {
    const owner = await createUser("EMPLOYER");
    const intruder = await createUser("EMPLOYER");
    const job = await createJob(owner.id);
    await rejectsWith(updateJobForEmployer(intruder, job.id, validJobInput({ title: "Hijacked job title" })), /does not belong/);
    await rejectsWith(closeJobForEmployer(intruder, job.id), /does not belong/);
    const unchanged = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(unchanged.title, job.title);
    assert.equal(unchanged.status, "OPEN");
  });

  test("the owner can close an open job once", async () => {
    const employer = await createUser("EMPLOYER");
    const job = await createJob(employer.id);
    await closeJobForEmployer(employer, job.id);
    assert.equal((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status, "CLOSED");
    await rejectsWith(closeJobForEmployer(employer, job.id), /already closed/);
  });
});
