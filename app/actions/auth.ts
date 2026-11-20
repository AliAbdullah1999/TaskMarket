"use server";

import { redirect } from "next/navigation";
import { type ActionState, runAction, text } from "@/lib/action-state";
import { createSession, destroySession } from "@/lib/auth";
import { clientIp } from "@/lib/request";
import { safeNext } from "@/lib/safe-redirect";
import { authenticate, registerUser } from "@/lib/services/accounts";

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

export async function logout() {
  await destroySession();
  redirect("/");
}
