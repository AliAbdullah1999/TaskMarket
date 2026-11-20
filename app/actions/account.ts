"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, fail, runAction, text } from "@/lib/action-state";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { changePassword, deleteAccount, signOutEverywhere, updateAccountDetails } from "@/lib/services/accounts";

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
    const user = await getCurrentUser();
    const newPassword = text(formData, "newPassword");
    if (newPassword !== text(formData, "confirmPassword")) fail("The new passwords do not match.");
    const sessionVersion = await changePassword(user, { currentPassword: text(formData, "currentPassword"), newPassword });
    // Every other device is now signed out; re-issue this device's session.
    if (user) await createSession(user.id, sessionVersion);
    return "Password updated. You have been signed out on all other devices.";
  });
}

export async function signOutAllDevices(): Promise<ActionState> {
  const result = await runAction(async () => {
    await signOutEverywhere(await getCurrentUser());
    await destroySession();
  });
  if (result?.error) return result;
  redirect("/login");
}

export async function removeAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    await deleteAccount(await getCurrentUser(), {
      password: text(formData, "password"),
      confirmation: text(formData, "confirmation"),
    });
    await destroySession();
  });
  if (result?.error) return result;
  redirect("/?account=deleted");
}
