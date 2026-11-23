"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { inviteCandidateToJob } from "@/lib/services/invitations";

export async function inviteCandidate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const profileId = text(formData, "profileId");
    await inviteCandidateToJob(await getCurrentUser(), {
      profileId,
      jobId: text(formData, "jobId"),
      message: text(formData, "message"),
    });
    revalidatePath(`/candidates/${profileId}`);
    revalidatePath("/applications");
    return "Invitation sent. The candidate has been emailed a link to your job.";
  });
}
