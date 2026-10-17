import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { updateCandidateProfile, updateEmployerProfile } from "@/app/actions/profiles";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  if (user.userType === "ADMIN") redirect("/admin");
  if (user.userType !== "CANDIDATE" && user.userType !== "EMPLOYER") redirect("/dashboard");

  if (user.userType === "CANDIDATE") {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <PageHeader eyebrow="Candidate profile" title="Tell employers about yourself" description="Keep your profile current so hiring teams can understand your experience and skills." />
        <ActionForm action={updateCandidateProfile} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="Professional headline" hint="For example: Product designer with 5 years of fintech experience">
            <input name="headline" maxLength={120} defaultValue={profile?.headline ?? ""} className={inputClass} />
          </Field>
          <Field label="Professional summary">
            <textarea name="summary" rows={7} maxLength={2000} defaultValue={profile?.summary ?? ""} className={inputClass} />
          </Field>
          <Field label="Skills" hint="Separate skills with commas (up to 20)">
            <input name="skills" maxLength={1000} defaultValue={profile?.skills.join(", ") ?? ""} className={inputClass} />
          </Field>
          <Field label="Years of experience">
            <input name="experienceYears" type="number" min="0" max="60" defaultValue={profile?.experienceYears ?? ""} className={inputClass} />
          </Field>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
            <input type="checkbox" name="isPublic" defaultChecked={profile?.isPublic ?? false} className="mt-1 accent-emerald-600" />
            <span><strong className="block text-slate-900">Show my profile in employer search</strong>Only employers with an active Growth plan can view your public candidate profile. You can turn this off at any time.</span>
          </label>
          <div className="flex justify-end"><SubmitButton>Save candidate profile</SubmitButton></div>
        </ActionForm>
      </main>
    );
  }

  const profile = await prisma.employerProfile.findUnique({ where: { userId: user.id } });
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader eyebrow="Employer profile" title="Represent your organization" description="A complete company profile helps candidates understand who is hiring." />
      <ActionForm action={updateEmployerProfile} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Field label="Company name">
          <input name="companyName" required minLength={2} maxLength={120} defaultValue={profile?.companyName ?? user.businessName ?? ""} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Industry">
            <input name="industry" maxLength={100} defaultValue={profile?.industry ?? ""} className={inputClass} />
          </Field>
          <Field label="Website" hint="Use the full https:// address">
            <input name="website" type="url" placeholder="https://example.com" defaultValue={profile?.website ?? ""} className={inputClass} />
          </Field>
        </div>
        <Field label="About the company">
          <textarea name="description" rows={6} maxLength={2000} defaultValue={profile?.description ?? ""} className={inputClass} />
        </Field>
        <div className="flex justify-end"><SubmitButton>Save employer profile</SubmitButton></div>
      </ActionForm>
    </main>
  );
}
