"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, int, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { submitApplication, updateApplicationStatusForEmployer } from "@/lib/services/applications";
import { type JobInput, closeJobForEmployer, createJobForEmployer, updateJobForEmployer } from "@/lib/services/jobs";

function jobInput(formData: FormData): JobInput {
  return {
    title: text(formData, "title"),
    description: text(formData, "description"),
    requirements: text(formData, "requirements"),
    category: text(formData, "category"),
    city: text(formData, "city"),
    employmentType: text(formData, "employmentType"),
    workplaceType: text(formData, "workplaceType"),
    salaryMin: int(formData, "salaryMin"),
    salaryMax: int(formData, "salaryMax"),
  };
}

function revalidateJobViews(jobId?: string) {
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/jobs/manage");
  revalidatePath("/dashboard");
  revalidatePath("/applications");
}

export async function createJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let jobId = "";
  const result = await runAction(async () => {
    const job = await createJobForEmployer(await getCurrentUser(), jobInput(formData));
    jobId = job.id;
    revalidateJobViews();
  });
  if (result?.error) return result;
  redirect(`/jobs/${jobId}?notice=published`);
}

export async function updateJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const jobId = text(formData, "jobId");
  const result = await runAction(async () => {
    await updateJobForEmployer(await getCurrentUser(), jobId, jobInput(formData));
    revalidateJobViews(jobId);
  });
  if (result?.error) return result;
  redirect(`/jobs/${jobId}?notice=updated`);
}

export async function closeJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const jobId = text(formData, "jobId");
    await closeJobForEmployer(await getCurrentUser(), jobId);
    revalidateJobViews(jobId);
    return "Job listing closed. It no longer accepts applications.";
  });
}

export async function applyToJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const application = await submitApplication(await getCurrentUser(), {
      jobId: text(formData, "jobId"),
      coverLetter: text(formData, "coverLetter"),
    });
    revalidateJobViews(application.jobId);
    return "Application submitted. You can track its status from My applications.";
  });
}

export async function updateApplicationStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { jobId } = await updateApplicationStatusForEmployer(await getCurrentUser(), {
      applicationId: text(formData, "applicationId"),
      status: text(formData, "status"),
    });
    revalidateJobViews(jobId);
    return "Application status updated.";
  });
}
