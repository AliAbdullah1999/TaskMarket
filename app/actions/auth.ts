"use server";

import { redirect } from "next/navigation";
import { type ActionState, fail, runAction, text } from "@/lib/action-state";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/request";
import { safeNext } from "@/lib/safe-redirect";
import { authenticate, registerUser } from "@/lib/services/accounts";
import { requestPasswordReset, resendVerification, resetPasswordWithToken, sendVerificationEmail } from "@/lib/services/recovery";

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await registerUser({
      fullName: text(formData, "fullName"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      city: text(formData, "city"),
      password: text(formData, "password"),
      userType: text(formData, "userType"),
      businessName: text(formData, "businessName"),
      acceptTerms: formData.get("acceptTerms") === "on",
      ip: await clientIp(),
    });
    await createSession(user.id, user.sessionVersion);
    await sendVerificationEmail(user.id);
  });
  if (result?.error) return result;
  redirect("/profile?welcome=1");
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await authenticate(text(formData, "email"), text(formData, "password"), { ip: await clientIp() });
    await createSession(user.id, user.sessionVersion);
  });
  if (result?.error) return result;
  redirect(safeNext(text(formData, "next")));
}

export async function forgotPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requestPasswordReset(text(formData, "email"), { ip: await clientIp() });
    // The same message whether or not the address is registered.
    return "If an account exists for that email, we have sent a link to reset the password. The link works for 1 hour.";
  });
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const newPassword = text(formData, "newPassword");
    if (newPassword !== text(formData, "confirmPassword")) fail("The passwords do not match.");
    await resetPasswordWithToken({ token: text(formData, "token"), newPassword });
  });
  if (result?.error) return result;
  redirect("/login?reset=1");
}

export async function resendVerificationEmail(): Promise<ActionState> {
  return runAction(async () => {
    await resendVerification(await getCurrentUser());
    return "Confirmation email sent. Check your inbox and spam folder.";
  });
}

export async function logout() {
  await destroySession();
  redirect("/");
}
