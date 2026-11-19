import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "../db";
import { getCandidateApplicationAllowance, isJobAcceptingApplications } from "../entitlements";
import { fail } from "../errors";
import { isUniqueViolation, serializable } from "../transactions";
import type { Actor } from "./jobs";

/** Statuses an employer may set, and the statuses from which a change is still allowed. */
export const EMPLOYER_SETTABLE_STATUSES: ApplicationStatus[] = ["REVIEWING", "SHORTLISTED", "HIRED", "REJECTED"];
export const OPEN_APPLICATION_STATUSES: ApplicationStatus[] = ["SUBMITTED", "REVIEWING", "SHORTLISTED"];

export async function submitApplication(
  actor: Actor | null,
  input: { jobId: string; coverLetter: string },
  now = new Date(),
) {
  if (!actor) fail("Please log in to apply.");
  if (actor.userType !== "CANDIDATE") fail("Only candidate accounts can apply for jobs.");
  const coverLetter = input.coverLetter.trim();
  if (coverLetter.length > 3000) fail("Cover letter must be 3,000 characters or fewer.");
  if (!input.jobId) fail("This job could not be found.");

  try {
    return await serializable(async (tx) => {
      const job = await tx.job.findUnique({
        where: { id: input.jobId },
        select: { id: true, employerId: true, status: true, expiresAt: true },
      });
      if (!job) fail("This job could not be found.");
      if (!isJobAcceptingApplications(job, now)) fail("This job is no longer accepting applications.");

      const duplicate = await tx.jobApplication.findUnique({
        where: { jobId_candidateId: { jobId: job.id, candidateId: actor.id } },
        select: { id: true },
      });
      if (duplicate) fail("You have already applied for this job.");

      const allowance = await getCandidateApplicationAllowance(tx, actor.id, now);
      if (!allowance.canApply) {
        fail("You have used all 3 free applications for this month. Upgrade to Candidate Pro to keep applying.");
      }

      return tx.jobApplication.create({
        data: { jobId: job.id, candidateId: actor.id, employerId: job.employerId, coverLetter: coverLetter || null },
        select: { id: true, jobId: true },
      });
    }, "Your application could not be submitted because your application count changed. Please try again.");
  } catch (error) {
    if (isUniqueViolation(error)) fail("You have already applied for this job.");
    throw error;
  }
}

export async function updateApplicationStatusForEmployer(
  actor: Actor | null,
  input: { applicationId: string; status: string },
) {
  if (!actor) fail("Please log in to continue.");
  if (actor.userType !== "EMPLOYER") fail("Only employers can review applications.");
  const status = EMPLOYER_SETTABLE_STATUSES.find((value) => value === input.status);
  if (!status) fail("Choose a valid application status.");

  const application = await prisma.jobApplication.findFirst({
    where: { id: input.applicationId, employerId: actor.id, job: { employerId: actor.id } },
    select: { id: true, jobId: true, status: true },
  });
  if (!application) fail("Application not found.");

  const updated = await prisma.jobApplication.updateMany({
    where: { id: application.id, employerId: actor.id, status: { in: OPEN_APPLICATION_STATUSES } },
    data: { status },
  });
  if (!updated.count) fail("This application has already been finalised and can no longer be changed.");
  return { jobId: application.jobId };
}
