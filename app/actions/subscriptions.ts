"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, fail, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const planByRole = {
  CANDIDATE: "CANDIDATE_PRO",
  EMPLOYER: "EMPLOYER_GROWTH",
} as const;

export async function requestSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) fail("Please log in to request a plan.");
    if (user.userType !== "CANDIDATE" && user.userType !== "EMPLOYER") fail("This account type does not have membership plans.");

    const requestedPlan = text(formData, "plan");
    const expectedPlan = planByRole[user.userType];
    if (requestedPlan !== expectedPlan) fail("That plan is not available for this account type.");

    const existing = await prisma.subscription.findFirst({
      where: { userId: user.id, status: { in: ["ACTIVE", "REQUESTED"] } },
      select: { id: true, status: true, currentPeriodEnd: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.status === "REQUESTED") fail("You already have a plan request awaiting review.");
    if (existing?.status === "ACTIVE" && existing.currentPeriodEnd && existing.currentPeriodEnd > new Date()) {
      fail("You already have an active plan.");
    }

    await prisma.subscription.create({
      data: { userId: user.id, plan: expectedPlan },
    });
    revalidatePath("/pricing");
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return "Plan request submitted. No payment has been collected; the team will contact you with payment instructions.";
  });
}
