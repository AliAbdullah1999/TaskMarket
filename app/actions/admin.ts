"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { reviewMembershipRequest, setAccountStatus } from "@/lib/services/memberships";
import { removeJobAsAdmin } from "@/lib/services/moderation";

export async function setUserStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const status = await setAccountStatus(await getCurrentUser(), {
      userId: text(formData, "userId"),
      status: text(formData, "status"),
    });
    revalidatePath("/admin");
    revalidatePath("/admin/accounts");
    return status === "SUSPENDED" ? "Account suspended. The user is signed out immediately." : "Account reactivated.";
  });
}

export async function removeJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const jobId = text(formData, "jobId");
    await removeJobAsAdmin(await getCurrentUser(), { jobId, reason: text(formData, "reason") });
    revalidatePath("/admin");
    revalidatePath("/admin/jobs");
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    return "Listing removed. The employer has been notified.";
  });
}

export async function reviewSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const decision = text(formData, "decision");
    await reviewMembershipRequest(await getCurrentUser(), {
      subscriptionId: text(formData, "subscriptionId"),
      decision,
      paymentReference: text(formData, "paymentReference"),
      note: text(formData, "note"),
    });
    revalidatePath("/admin");
    revalidatePath("/admin/memberships");
    revalidatePath("/pricing");
    revalidatePath("/dashboard");
    return decision === "approve" ? "Membership activated for 30 days." : "Membership request rejected.";
  });
}
