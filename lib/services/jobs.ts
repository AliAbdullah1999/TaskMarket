import { EmploymentType, WorkplaceType, type UserType } from "@prisma/client";
import { CITIES, JOB_CATEGORIES, JOB_LISTING_DAYS } from "../constants";
import { prisma } from "../db";
import { getEmployerJobAllowance } from "../entitlements";
import { fail } from "../errors";
import { addDays } from "../time";
import { serializable } from "../transactions";

export type Actor = { id: string; userType: UserType };

export type JobInput = {
  title: string;
  description: string;
  requirements: string;
  category: string;
  city: string;
  employmentType: string;
  workplaceType: string;
  /** null = not provided; NaN = provided but not a whole number. */
  salaryMin: number | null;
  salaryMax: number | null;
};

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((candidate) => candidate === value);
}

/** Validates job fields and returns data ready for Prisma. Shared by create and edit. */
export function validateJobInput(input: JobInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const requirements = input.requirements.trim();
  const { category, city, employmentType, workplaceType, salaryMin, salaryMax } = input;

  if (title.length < 8 || title.length > 120) fail("Job title must be between 8 and 120 characters.");
  if (description.length < 50 || description.length > 10000) fail("Job description must be between 50 and 10,000 characters.");
  if (requirements.length > 5000) fail("Requirements must be 5,000 characters or fewer.");
  if (!isOneOf(JOB_CATEGORIES, category)) fail("Choose a job category.");
  if (!isOneOf(CITIES, city)) fail("Choose a valid city.");
  if (!isOneOf(Object.values(EmploymentType), employmentType)) fail("Choose an employment type.");
  if (!isOneOf(Object.values(WorkplaceType), workplaceType)) fail("Choose a workplace type.");
  if (
    Number.isNaN(salaryMin) ||
    Number.isNaN(salaryMax) ||
    (salaryMin !== null && salaryMin < 1) ||
    (salaryMax !== null && salaryMax < 1)
  ) {
    fail("Enter a positive whole-number salary, or leave the field empty.");
  }
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) fail("Minimum salary cannot exceed the maximum.");
  if ((salaryMax ?? salaryMin ?? 0) > 100_000_000) fail("Salary is above the supported range.");

  return {
    title,
    description,
    requirements: requirements || null,
    category,
    city,
    employmentType,
    workplaceType,
    salaryMin,
    salaryMax,
  };
}

function requireEmployer(actor: Actor | null): asserts actor is Actor {
  if (!actor) fail("Please log in to continue.");
  if (actor.userType !== "EMPLOYER") fail("Only employer accounts can manage job listings.");
}

export async function createJobForEmployer(actor: Actor | null, input: JobInput, now = new Date()) {
  requireEmployer(actor);
  const data = validateJobInput(input);
  return serializable(async (tx) => {
    const allowance = await getEmployerJobAllowance(tx, actor.id, now);
    if (!allowance.canPublish) {
      fail(
        `Your current plan allows ${allowance.limit} active job${allowance.limit === 1 ? "" : "s"}. ` +
          (allowance.isGrowth ? "Close a listing to publish another." : "Upgrade to Employer Growth for up to 5."),
      );
    }
    return tx.job.create({
      data: { ...data, employerId: actor.id, expiresAt: addDays(now, JOB_LISTING_DAYS) },
      select: { id: true },
    });
  }, "Your active job count changed while you were publishing. Please try again.");
}

/** Edits the content of a job the employer owns. Status and expiry are not changed by editing. */
export async function updateJobForEmployer(actor: Actor | null, jobId: string, input: JobInput) {
  requireEmployer(actor);
  const data = validateJobInput(input);
  const updated = await prisma.job.updateMany({
    where: { id: jobId, employerId: actor.id, status: { not: "ARCHIVED" } },
    data,
  });
  if (!updated.count) fail("Job not found, or it does not belong to your account.");
}

export async function closeJobForEmployer(actor: Actor | null, jobId: string) {
  requireEmployer(actor);
  const updated = await prisma.job.updateMany({
    where: { id: jobId, employerId: actor.id, status: "OPEN" },
    data: { status: "CLOSED" },
  });
  if (!updated.count) fail("This job is already closed or does not belong to your account.");
}
