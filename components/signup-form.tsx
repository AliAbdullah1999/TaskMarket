"use client";

import Link from "next/link";
import { useState } from "react";
import { signup } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { CITIES } from "@/lib/constants";

type SignupRole = "CANDIDATE" | "EMPLOYER";

const roles: { value: SignupRole; title: string; body: string }[] = [
  { value: "CANDIDATE", title: "I’m looking for work", body: "Build a profile, discover jobs and apply." },
  { value: "EMPLOYER", title: "I’m hiring", body: "Post vacancies and manage applicants." },
];

export function SignupForm({ appName, defaultRole }: { appName: string; defaultRole: SignupRole }) {
  const [role, setRole] = useState<SignupRole>(defaultRole);
  const isEmployer = role === "EMPLOYER";

  return (
    <ActionForm action={signup} className="mt-8 space-y-6 rounded-[26px] border border-[#e7eae5] bg-white p-6 shadow-[0_16px_48px_rgba(23,35,31,0.07)] sm:p-8">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">How will you use {appName}?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((item) => (
            <label
              key={item.value}
              className="cursor-pointer rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50/70 has-[:checked]:shadow-sm"
            >
              <input
                type="radio"
                name="userType"
                value={item.value}
                checked={role === item.value}
                onChange={() => setRole(item.value)}
                className="sr-only"
              />
              <span className="block font-semibold text-slate-900">{item.title}</span>
              <span className="mt-1 block text-xs text-slate-600">{item.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="fullName" required autoComplete="name" className={inputClass} />
        </Field>
        {isEmployer ? (
          <Field label="Company name" hint="Required for employer accounts">
            <input name="businessName" required autoComplete="organization" className={inputClass} />
          </Field>
        ) : null}
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
          <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input type="checkbox" name="acceptTerms" required className="mt-1 h-4 w-4 accent-emerald-700" />
        <span>
          I am 18 or older and I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-semibold text-emerald-800 hover:underline">Terms of Service</Link> and{" "}
          <Link href="/privacy" target="_blank" className="font-semibold text-emerald-800 hover:underline">Privacy Policy</Link>.
        </span>
      </label>

      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </ActionForm>
  );
}
