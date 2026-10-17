"use server";

import { ApplicationStatus, EmploymentType, WorkplaceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, fail, int, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import {
  FREE_ACTIVE_JOB_LIMIT,
  FREE_APPLICATION_LIMIT,
  GROWTH_ACTIVE_JOB_LIMIT,
  CITIES,
  JOB_CATEGORIES,
} from "@/lib/constants";
import { prisma } from "@/lib/db";

async function signedInUser() {
  const user = await getCurrentUser();
  if (!user) fail("Please log in to continue.");
  return user;
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((candidate) => candidate === value);
}

async function hasActivePlan(userId: string, plan: "CANDIDATE_PRO" | "EMPLOYER_GROWTH") {
  return Boolean(
    await prisma.subscription.findFirst({
      where: { userId, plan, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
      select: { id: true },
    }),
  );
}

export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let jobId = "";
  const result = await runAction(async () => {
    const user = await signedInUser();
    if (user.userType !== "EMPLOYER") fail("Only employer accounts can post jobs.");

    const [isGrowth, activeJobs] = await Promise.all([
      hasActivePlan(user.id, "EMPLOYER_GROWTH"),
      prisma.job.count({
        where: {
          employerId: user.id,
          status: "OPEN",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
    ]);
    const limit = isGrowth ? GROWTH_ACTIVE_JOB_LIMIT : FREE_ACTIVE_JOB_LIMIT;
    if (activeJobs >= limit) fail(`Your current plan allows ${limit} active job${limit === 1 ? "" : "s"}. View plans to increase your limit.`);

    const title = text(formData, "title");
    const description = text(formData, "description");
    const requirements = text(formData, "requirements");
    const category = text(formData, "category");
    const city = text(formData, "city");
    const employmentType = text(formData, "employmentType");
    const workplaceType = text(formData, "workplaceType");
    const salaryMin = int(formData, "salaryMin");
    const salaryMax = int(formData, "salaryMax");

    if (title.length < 8 || title.length > 120) fail("Job title must be between 8 and 120 characters.");
    if (description.length < 50 || description.length > 10000) fail("Job description must be between 50 and 10,000 characters.");
    if (requirements.length > 5000) fail("Requirements must be 5,000 characters or fewer.");
    if (!(JOB_CATEGORIES as readonly string[]).includes(category)) fail("Choose a job category.");
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
    if (salaryMax !== null && salaryMax > 100_000_000) fail("Maximum salary is above the supported range.");

    const job = await prisma.job.create({
      data: {
        employerId: user.id,
        title,
        description,
        requirements: requirements || null,
        category,
        city,
        employmentType,
        workplaceType,
        salaryMin,
        salaryMax,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    jobId = job.id;
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
  });
  if (result?.error) return result;
  redirect(`/jobs/${jobId}`);
}

export async function applyToJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    if (user.userType !== "CANDIDATE") fail("Only candidate accounts can apply for jobs.");
    const jobId = text(formData, "jobId");
    const coverLetter = text(formData, "coverLetter");
    if (coverLetter.length > 3000) fail("Cover letter must be 3,000 characters or fewer.");

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, employerId: true, status: true, expiresAt: true } });
    if (!job || job.status !== "OPEN" || (job.expiresAt && job.expiresAt <= new Date())) fail("This job is no longer accepting applications.");
    const duplicate = await prisma.jobApplication.findUnique({ where: { jobId_candidateId: { jobId, candidateId: user.id } } });
    if (duplicate) fail("You have already applied for this job.");

    const isPro = await hasActivePlan(user.id, "CANDIDATE_PRO");
    if (!isPro) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const applicationCount = await prisma.jobApplication.count({
        where: { candidateId: user.id, createdAt: { gte: monthStart }, status: { not: "WITHDRAWN" } },
      });
      if (applicationCount >= FREE_APPLICATION_LIMIT) fail("You have reached the free monthly application limit. Upgrade your plan to keep applying.");
    }

    await prisma.jobApplication.create({
      data: { jobId, candidateId: user.id, employerId: job.employerId, coverLetter: coverLetter || null },
    });
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/dashboard");
    return "Application submitted.";
  });
}

export async function updateApplicationStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    if (user.userType !== "EMPLOYER") fail("Only employers can review applications.");
    const applicationId = text(formData, "applicationId");
    const status = text(formData, "status");
    const allowed: ApplicationStatus[] = ["REVIEWING", "SHORTLISTED", "REJECTED", "HIRED"];
    if (!isOneOf(allowed, status)) fail("Choose a valid application status.");
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: { jobId: true, employerId: true },
    });
    if (!application || application.employerId !== user.id) fail("Application not found.");

    const updated = await prisma.jobApplication.updateMany({
      where: { id: applicationId, employerId: user.id, status: { in: ["SUBMITTED", "REVIEWING", "SHORTLISTED"] } },
      data: { status },
    });
    if (!updated.count) fail("Application not found or it can no longer be changed.");
    revalidatePath(`/jobs/${application.jobId}`);
    revalidatePath("/dashboard");
    return "Application updated.";
  });
}

export async function closeJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    if (user.userType !== "EMPLOYER") fail("Only employers can manage job listings.");
    const jobId = text(formData, "jobId");
    const updated = await prisma.job.updateMany({
      where: { id: jobId, employerId: user.id, status: "OPEN" },
      data: { status: "CLOSED" },
    });
    if (!updated.count) fail("This job is already closed or does not belong to your account.");
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    return "Job listing closed.";
  });
}
