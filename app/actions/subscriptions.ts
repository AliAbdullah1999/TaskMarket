"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { cancelMembershipRequest, requestMembership } from "@/lib/services/memberships";

function revalidateMembershipViews() {
  revalidatePath("/pricing");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function requestSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requestMembership(await getCurrentUser(), { plan: text(formData, "plan"), reference: text(formData, "reference") });
    revalidateMembershipViews();
    return "Request submitted. Your plan stays the same until an administrator confirms your payment.";
  });
}

export async function cancelSubscriptionRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await cancelMembershipRequest(await getCurrentUser(), text(formData, "subscriptionId"));
    revalidateMembershipViews();
    return "Request cancelled.";
  });
}
