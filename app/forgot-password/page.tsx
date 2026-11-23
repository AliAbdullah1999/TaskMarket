import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { forgotPassword } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/account");

  return (
    <main className="mx-auto max-w-md px-5 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Account help</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Forgot your password?</h1>
      <p className="mt-3 leading-7 text-slate-600">Enter the email you signed up with and we will send you a link to choose a new password.</p>

      <ActionForm action={forgotPassword} resetOnSuccess className="mt-8 space-y-5 rounded-[26px] border border-[#e7eae5] bg-white p-6 shadow-[0_16px_48px_rgba(23,35,31,0.07)] sm:p-8">
        <Field label="Email">
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
        </Field>
        <SubmitButton className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
      </ActionForm>

      <p className="mt-7 text-center text-sm text-slate-600">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-emerald-700">Back to log in</Link>
      </p>
    </main>
  );
}
