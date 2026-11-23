import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { inviteCandidate } from "@/app/actions/candidates";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar, Card, Field, buttonClass, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeJobWhere, canSearchCandidates } from "@/lib/entitlements";
import { formatDate } from "@/lib/format";
import { getSearchableCandidate } from "@/lib/services/candidates";

export const metadata: Metadata = { title: "Candidate profile" };

export default async function CandidateProfilePage(props: PageProps<"/candidates/[id]">) {
  const user = await requireUser(["EMPLOYER"]);
  if (!(await canSearchCandidates(prisma, user.id))) redirect("/candidates");
  const { id } = await props.params;
  // Private profiles and inactive accounts resolve to "not found" rather than revealing that they exist.
  const candidate = await getSearchableCandidate(id);
  if (!candidate) notFound();

  const [openJobs, invitations] = await Promise.all([
    prisma.job.findMany({
      where: { AND: [{ employerId: user.id }, activeJobWhere(new Date())] },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.jobInvitation.findMany({
      where: { employerId: user.id, candidate: { candidateProfile: { id } } },
      orderBy: { createdAt: "desc" },
      select: { jobId: true, createdAt: true, job: { select: { id: true, title: true } } },
    }),
  ]);
  const invitedJobIds = new Set(invitations.map((item) => item.jobId));
  const invitableJobs = openJobs.filter((job) => !invitedJobIds.has(job.id));

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/candidates" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 hover:text-emerald-950">← Back to search</Link>
      <Card className="mt-4">
        <div className="flex items-center gap-4">
          <Avatar name={candidate.user.fullName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{candidate.user.fullName}</h1>
            <p className="mt-1 text-slate-600">{candidate.headline ?? "Candidate"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {candidate.user.city ?? "Location not set"}
              {candidate.experienceYears !== null ? ` · ${candidate.experienceYears} ${candidate.experienceYears === 1 ? "year" : "years"} of experience` : ""}
            </p>
          </div>
        </div>
        {candidate.summary ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Professional summary</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{candidate.summary}</p>
          </section>
        ) : null}
        {candidate.skills.length ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.skills.map((skill) => <span key={skill} className="rounded-full bg-[#f3f5f1] px-3 py-1.5 text-sm font-medium text-slate-700">{skill}</span>)}
            </div>
          </section>
        ) : null}
        <p className="mt-8 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          Profile updated {formatDate(candidate.updatedAt)}. Contact details are shared only when a candidate applies to one of your jobs.
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-bold text-slate-950">Invite to apply</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We email {candidate.user.fullName.split(" ")[0]} your invitation with a link to the job. If they apply, you will see their application and contact email.
        </p>
        {invitations.length ? (
          <ul className="mt-4 space-y-1 text-sm text-slate-600">
            {invitations.map((item) => (
              <li key={item.jobId}>
                ✓ Invited to <Link href={`/jobs/${item.job.id}`} className="font-semibold text-emerald-800 hover:underline">{item.job.title}</Link> on {formatDate(item.createdAt)}
              </li>
            ))}
          </ul>
        ) : null}
        {invitableJobs.length ? (
          <ActionForm action={inviteCandidate} className="mt-5 space-y-4" resetOnSuccess>
            <input type="hidden" name="profileId" value={candidate.id} />
            <Field label="Job">
              <select name="jobId" required defaultValue={invitableJobs[0].id} className={inputClass}>
                {invitableJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
            </Field>
            <Field label="Message" hint="Optional, up to 500 characters. Included in the email.">
              <textarea name="message" rows={4} maxLength={500} className={inputClass} placeholder="Tell the candidate why their profile stood out." />
            </Field>
            <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
          </ActionForm>
        ) : openJobs.length ? (
          <p className="mt-4 text-sm font-medium text-slate-700">You have invited this candidate to all of your open jobs.</p>
        ) : (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">You need an open job listing to invite candidates.</p>
            <Link href="/jobs/new" className={`${buttonClass.primary} mt-3`}>Post a job</Link>
          </div>
        )}
      </Card>
    </main>
  );
}
