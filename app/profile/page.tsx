import type { Metadata } from "next";
import Link from "next/link";
import { updateProfile } from "@/app/actions/profile";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Field, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, CITIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage(props: PageProps<"/profile">) {
  const user = await requireUser();
  const { welcome } = await props.searchParams;
  const profile = user.taskerProfile;
  const isTasker = user.userType === "TASKER";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow={isTasker ? "Tasker profile" : "Account"}
        title={welcome ? "Welcome! Let's set up your profile" : "Your profile"}
        description={
          isTasker
            ? "Customers see your categories, cities, bio and starting price. Your NTN and phone number stay private."
            : "Your phone number is never shown to taskers."
        }
        action={
          isTasker ? (
            <Link href={`/taskers/${user.id}`} className="text-sm font-semibold text-emerald-700">
              View public profile →
            </Link>
          ) : null
        }
      />

      <ActionForm action={updateProfile} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input name="fullName" required defaultValue={user.fullName} className={inputClass} />
          </Field>
          <Field label="Business name" hint="Optional — shown instead of your name">
            <input name="businessName" defaultValue={user.businessName ?? ""} className={inputClass} />
          </Field>
          <Field label="Email">
            <input value={user.email} disabled className={`${inputClass} bg-slate-50 text-slate-500`} />
          </Field>
          <Field label="Mobile number">
            <input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="03001234567" className={inputClass} />
          </Field>
          <Field label="City">
            <select name="city" required defaultValue={user.city ?? ""} className={inputClass}>
              <option value="" disabled>
                Select city
              </option>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>

        {isTasker ? (
          <>
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-slate-900">Tax registration (NTN)</h2>
                {profile?.ntinVerified ? (
                  <Badge tone="green">Verified</Badge>
                ) : profile?.ntin ? (
                  <Badge tone="amber">Under review</Badge>
                ) : (
                  <Badge tone="red">Required to quote</Badge>
                )}
              </div>
              <Field
                label="NTN or CNIC"
                hint="Format 1234567-8, or your 13-digit CNIC if you are registered as an individual. Changing it restarts verification."
                className="mt-4"
              >
                <input name="ntin" defaultValue={profile?.ntin ?? ""} placeholder="1234567-8" className={inputClass} />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Service categories</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <label key={c} className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800">
                    <input type="checkbox" name="categories" value={c} defaultChecked={profile?.categories.includes(c)} className="sr-only" />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Cities you serve</legend>
              <div className="flex flex-wrap gap-2">
                {CITIES.map((c) => (
                  <label key={c} className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800">
                    <input type="checkbox" name="serviceAreas" value={c} defaultChecked={profile?.serviceAreas.includes(c)} className="sr-only" />
                    {c}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field label="Starting price (PKR)">
                <input name="priceFrom" type="number" min={0} step={100} defaultValue={profile?.priceFrom ?? ""} className={inputClass} />
              </Field>
              <Field label="Bio" hint="Experience, tools, languages, availability. No phone numbers.">
                <textarea name="bio" rows={4} maxLength={1200} defaultValue={profile?.bio ?? ""} className={inputClass} />
              </Field>
            </div>
          </>
        ) : null}

        <div className="flex justify-end">
          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </div>
      </ActionForm>
    </main>
  );
}
