import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updateCandidateProfile, updateEmployerProfile } from "@/app/actions/profiles";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar, Badge, Card, Field, Notice, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage(props: PageProps<"/profile">) {
  const user = await requireUser();
  const { welcome } = await props.searchParams;
  if (user.userType === "ADMIN") redirect("/admin");
  if (user.userType !== "CANDIDATE" && user.userType !== "EMPLOYER") redirect("/dashboard");

  if (user.userType === "CANDIDATE") {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
    return (
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
        <PageHeader eyebrow="Candidate profile" title="Tell employers about yourself" description="Keep your profile current so hiring teams can understand your experience and skills." />
        {welcome ? <Notice tone="success" title="Welcome to Connect HR!" className="mb-6">Your account is ready. Add your headline and skills, then browse open jobs. Your profile stays private until you choose to share it.</Notice> : null}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <ActionForm action={updateCandidateProfile} className="space-y-6 rounded-[24px] border border-[#e7eae5] bg-white p-6 shadow-[0_8px_28px_rgba(23,35,31,0.045)] sm:p-8">
            <Field label="Professional headline" hint="For example: Product designer with 5 years of fintech experience">
              <input name="headline" maxLength={120} defaultValue={profile?.headline ?? ""} className={inputClass} />
            </Field>
            <Field label="Professional summary" hint="A concise overview of your experience and strengths (up to 2,000 characters)">
              <textarea name="summary" rows={7} maxLength={2000} defaultValue={profile?.summary ?? ""} className={inputClass} />
            </Field>
            <Field label="Skills" hint="Separate skills with commas (up to 20, 40 characters each)">
              <input name="skills" maxLength={1000} defaultValue={profile?.skills.join(", ") ?? ""} className={inputClass} />
            </Field>
            <Field label="Years of experience" hint="Enter a number from 0 to 60">
              <input name="experienceYears" type="number" min="0" max="60" defaultValue={profile?.experienceYears ?? ""} className={inputClass} />
            </Field>
            <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-[#e2e7e0] bg-[#f8faf7] p-4 text-sm leading-6 text-slate-700">
              <input type="checkbox" name="isPublic" defaultChecked={profile?.isPublic ?? false} className="mt-1 accent-emerald-600" />
              <span><strong className="block text-slate-900">Show my profile in employer search</strong>Only employers with an active Growth plan can view your public candidate profile. You can turn this off at any time.</span>
            </label>
            <div className="flex justify-end"><SubmitButton>Save candidate profile</SubmitButton></div>
          </ActionForm>
          <aside className="space-y-4 xl:sticky xl:top-24">
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Profile preview</p>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={user.fullName} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{user.fullName}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.city ?? "Location not set"}</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">{profile?.headline || "Your professional headline"}</p>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-600">{profile?.summary || "Add a short summary to introduce your experience to employers."}</p>
              {profile?.skills.length ? <div className="mt-4 flex flex-wrap gap-1.5">{profile.skills.slice(0, 5).map((skill) => <span key={skill} className="rounded-full bg-[#f1f3ed] px-2.5 py-1 text-[10px] font-medium text-slate-600">{skill}</span>)}</div> : null}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <Badge tone={profile?.isPublic ? "green" : "slate"}>{profile?.isPublic ? "Public to eligible employers" : "Private profile"}</Badge>
                <p className="mt-2 text-xs leading-5 text-slate-500">You control whether your profile appears in employer search. Your email and phone are never shown there.</p>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Link href="/account" className="text-xs font-semibold text-emerald-800 hover:underline">Change your name or city in Account settings →</Link>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    );
  }

  const profile = await prisma.employerProfile.findUnique({ where: { userId: user.id } });
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader eyebrow="Employer profile" title="Represent your organization" description="A complete company profile helps candidates understand who is hiring." />
      {welcome ? <Notice tone="success" title="Welcome to Connect HR!" className="mb-6">Your employer account is ready. Complete your company profile, then post your first job.</Notice> : null}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <ActionForm action={updateEmployerProfile} className="space-y-6 rounded-[24px] border border-[#e7eae5] bg-white p-6 shadow-[0_8px_28px_rgba(23,35,31,0.045)] sm:p-8">
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
        <aside className="xl:sticky xl:top-24">
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Company preview</p>
            <span aria-hidden="true" className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8eee6] text-lg font-bold text-[#244d3b]">
              {(profile?.companyName ?? user.businessName ?? user.fullName).slice(0, 1).toUpperCase()}
            </span>
            <p className="mt-4 text-sm font-bold text-slate-950">{profile?.companyName ?? user.businessName ?? "Your company name"}</p>
            <p className="mt-1 text-xs text-slate-500">{profile?.industry || "Industry"}</p>
            <p className="mt-3 line-clamp-5 text-xs leading-5 text-slate-600">{profile?.description || "Add a brief introduction so candidates can learn about your organization."}</p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
