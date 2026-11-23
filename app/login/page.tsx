import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Notice, inputClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next, reset } = await props.searchParams;

  return (
    <main className="mx-auto max-w-md px-5 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Your next chapter</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Welcome back</h1>
      <p className="mt-3 leading-7 text-slate-600">Log in to manage your candidate profile, applications, or job listings.</p>

      {reset === "1" ? <Notice tone="success" className="mt-6">Your password has been changed. Log in with your new password.</Notice> : null}

      <ActionForm action={login} className="mt-8 space-y-5 rounded-[26px] border border-[#e7eae5] bg-white p-6 shadow-[0_16px_48px_rgba(23,35,31,0.07)] sm:p-8">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </Field>
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-emerald-700 hover:underline">Forgot your password?</Link>
        </p>
        <SubmitButton className="w-full" pendingLabel="Logging in…">
          Log in
        </SubmitButton>
      </ActionForm>

      <p className="mt-7 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-emerald-700">
          Create an account
        </Link>
      </p>
    </main>
  );
}
