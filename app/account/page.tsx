import type { Metadata } from "next";
import Link from "next/link";
import { removeAccount, signOutAllDevices, updateAccount, updatePassword } from "@/app/actions/account";
import { ActionForm, ConfirmSubmitButton, SubmitButton } from "@/components/action-form";
import { Card, Field, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CITIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader eyebrow="Account" title="Account settings" description="Your sign-in and contact details. Your email and phone number are never shown in public listings or candidate search." />
      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-bold text-slate-950">Personal details</h2>
          <ActionForm action={updateAccount} className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input name="fullName" required minLength={2} maxLength={100} autoComplete="name" defaultValue={user.fullName} className={inputClass} />
              </Field>
              <Field label="Email" hint={`${user.emailVerifiedAt ? "Confirmed." : "Not confirmed yet."} Contact support to change the email you sign in with.`}>
                <input value={user.email} readOnly disabled className={`${inputClass} bg-slate-50 text-slate-500`} />
              </Field>
              <Field label="City">
                <select name="city" required defaultValue={user.city ?? ""} className={inputClass}>
                  <option value="" disabled>Select city</option>
                  {CITIES.map((city) => <option key={city}>{city}</option>)}
                </select>
              </Field>
              <Field label="Mobile number" hint="Optional. Pakistani mobile, e.g. 03001234567. Never shown to other users.">
                <input name="phone" type="tel" autoComplete="tel" placeholder="03001234567" defaultValue={user.phone ?? ""} className={inputClass} />
              </Field>
            </div>
            <div className="flex justify-end"><SubmitButton pendingLabel="Saving…">Save details</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-950">Change password</h2>
          <ActionForm action={updatePassword} className="mt-5 space-y-5" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Current password">
                <input name="currentPassword" type="password" required autoComplete="current-password" className={inputClass} />
              </Field>
              <Field label="New password" hint="8+ characters with a letter and a number">
                <input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
              </Field>
              <Field label="Confirm new password">
                <input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
              </Field>
            </div>
            <div className="flex justify-end"><SubmitButton pendingLabel="Updating…">Update password</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-950">Security</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Signed in on a shared or lost device? Sign out everywhere to end every session, including this one. Changing your password also signs out all other devices.</p>
          <ActionForm action={signOutAllDevices} className="mt-4">
            <ConfirmSubmitButton title="Sign out of all devices?" message="You will be signed out here and on every other device, and will need to log in again." confirmLabel="Sign out everywhere" variant="primary">
              Sign out of all devices
            </ConfirmSubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-950">Your data</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Download a copy of everything we hold about you: account details, profile, applications, invitations, job listings and membership records. See our{" "}
            <Link href="/privacy" className="font-semibold text-emerald-800 hover:underline">Privacy Policy</Link> and{" "}
            <Link href="/terms" className="font-semibold text-emerald-800 hover:underline">Terms of Service</Link>.
          </p>
          <a href="/account/export" download className={`${buttonClass.secondary} mt-4`}>Download my data</a>
        </Card>

        {user.userType !== "ADMIN" ? (
          <Card className="border-rose-200">
            <h2 className="text-lg font-bold text-rose-900">Delete account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This permanently deletes your account{user.userType === "EMPLOYER" ? ", company profile, job listings and the applications received for them" : ", career profile and applications"}. It cannot be undone.
            </p>
            <ActionForm action={removeAccount} className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Current password">
                  <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
                </Field>
                <Field label="Type DELETE to confirm">
                  <input name="confirmation" required autoComplete="off" placeholder="DELETE" className={inputClass} />
                </Field>
              </div>
              <div className="flex justify-end">
                <ConfirmSubmitButton title="Delete your account permanently?" message="All of your data will be removed and you will be signed out. This cannot be undone." confirmLabel="Delete my account">
                  Delete my account
                </ConfirmSubmitButton>
              </div>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
