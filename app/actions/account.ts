"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, fail, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { changePassword, updateAccountDetails } from "@/lib/services/accounts";

export async function updateAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateAccountDetails(await getCurrentUser(), {
      fullName: text(formData, "fullName"),
      city: text(formData, "city"),
      phone: text(formData, "phone"),
    });
    revalidatePath("/", "layout");
    return "Account details saved.";
  });
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const newPassword = text(formData, "newPassword");
    if (newPassword !== text(formData, "confirmPassword")) fail("The new passwords do not match.");
    await changePassword(await getCurrentUser(), { currentPassword: text(formData, "currentPassword"), newPassword });
    return "Password updated.";
  });
}
