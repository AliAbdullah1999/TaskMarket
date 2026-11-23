import type { Metadata } from "next";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Notice, buttonClass, inputClass } from "@/components/ui";
import { isPasswordResetTokenValid } from "@/lib/services/recovery";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  const value = typeof token === "string" ? token : "";
  const valid = await isPasswordResetTokenValid(value);

  return (
    <main className="mx-auto max-w-md px-5 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Account help</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Choose a new password</h1>
      {valid ? (
        <>
          <p className="mt-3 leading-7 text-slate-600">After you save it, you will be signed out on every device and can log in with the new password.</p>
          <ActionForm action={resetPassword} className="mt-8 space-y-5 rounded-[26px] border border-[#e7eae5] bg-white p-6 shadow-[0_16px_48px_rgba(23,35,31,0.07)] sm:p-8">
            <input type="hidden" name="token" value={value} />
            <Field label="New password" hint="8+ characters with a letter and a number">
              <input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
            </Field>
            <Field label="Confirm new password">
              <input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Saving…">Save new password</SubmitButton>
          </ActionForm>
        </>
      ) : (
        <>
          <Notice tone="warning" title="This link is invalid or has expired" className="mt-6">
            Reset links work for 1 hour and can be used once. Request a new one to continue.
          </Notice>
          <Link href="/forgot-password" className={`${buttonClass.primary} mt-6`}>Request a new link</Link>
        </>
      )}
    </main>
  );
}
