import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, CITIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Create an account" };

const ROLES = [
  { value: "CANDIDATE", title: "I’m looking for work", body: "Build a profile, discover jobs and apply." },
  { value: "EMPLOYER", title: "I’m hiring", body: "Post vacancies and manage applicants." },
];

export default async function SignupPage(props: PageProps<"/signup">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { role } = await props.searchParams;
  const defaultRole = ROLES.some((r) => r.value === role) ? (role as string) : "CANDIDATE";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-2 text-slate-600">Join Pakistan&apos;s job and recruitment network.</p>

      <ActionForm action={signup} className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">How will you use {APP_NAME}?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className="cursor-pointer rounded-2xl border border-slate-200 p-4 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
              >
                <input type="radio" name="userType" value={r.value} defaultChecked={r.value === defaultRole} className="sr-only" />
                <span className="block font-semibold text-slate-900">{r.title}</span>
                <span className="mt-1 block text-xs text-slate-600">{r.body}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input name="fullName" required autoComplete="name" className={inputClass} />
          </Field>
          <Field label="Company name" hint="Required for employer accounts">
            <input name="businessName" autoComplete="organization" className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </Field>
          <Field label="Mobile number" hint="Never shown to other users">
            <input name="phone" type="tel" placeholder="03001234567" autoComplete="tel" className={inputClass} />
          </Field>
          <Field label="City">
            <select name="city" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Select city
              </option>
              {CITIES.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </Field>
          <Field label="Password" hint="8+ characters with a letter and a number">
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          </Field>
        </div>

        <SubmitButton className="w-full" pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-emerald-700">
          Log in
        </Link>
      </p>
    </main>
  );
}
