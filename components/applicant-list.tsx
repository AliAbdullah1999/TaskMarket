import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { updateApplicationStatus } from "@/app/actions/jobs";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, inputClass } from "@/components/ui";
import { OPEN_APPLICATION_STATUSES } from "@/lib/services/applications";
import { applicationStatusMeta, formatDate } from "@/lib/format";

/**
 * Fields an employer may see for applicants to their own jobs. The email is shared
 * because the candidate applied to this employer (disclosed on the apply form);
 * phone numbers and other account data are never selected.
 */
export const APPLICANT_SELECT = {
  id: true,
  status: true,
  coverLetter: true,
  createdAt: true,
  updatedAt: true,
  job: { select: { id: true, title: true } },
  candidate: {
    select: {
      fullName: true,
      email: true,
      city: true,
      candidateProfile: { select: { headline: true, summary: true, skills: true, experienceYears: true } },
    },
  },
} satisfies Prisma.JobApplicationSelect;

export type Applicant = Prisma.JobApplicationGetPayload<{ select: typeof APPLICANT_SELECT }>;

export function ApplicantList({ applications, showJob = false }: { applications: Applicant[]; showJob?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100">
      {applications.map((application) => {
        const profile = application.candidate.candidateProfile;
        const meta = applicationStatusMeta[application.status];
        const canChange = OPEN_APPLICATION_STATUSES.includes(application.status);
        return (
          <li key={application.id} className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{application.candidate.fullName}</p>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
              {profile?.headline ? <p className="mt-1 text-sm text-slate-600">{profile.headline}</p> : null}
              <p className="mt-1 text-xs text-slate-500">
                {application.candidate.city ?? "Location not set"}
                {profile?.experienceYears != null ? ` · ${profile.experienceYears} ${profile.experienceYears === 1 ? "year" : "years"} experience` : ""}
                {` · Applied ${formatDate(application.createdAt)}`}
                {showJob ? <> · <Link href={`/jobs/${application.job.id}`} className="text-emerald-700 hover:underline">{application.job.title}</Link></> : null}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Contact: <a href={`mailto:${application.candidate.email}`} className="font-medium text-emerald-800 hover:underline">{application.candidate.email}</a>
              </p>
              {profile?.summary || profile?.skills.length || application.coverLetter ? (
                <details className="mt-3 text-sm text-slate-700">
                  <summary className="inline-flex min-h-9 cursor-pointer items-center font-semibold text-emerald-800">View application details</summary>
                  {application.coverLetter ? (
                    <div className="mt-2 rounded-xl bg-[#f8faf7] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cover letter</p>
                      <p className="mt-1 whitespace-pre-line leading-6">{application.coverLetter}</p>
                    </div>
                  ) : null}
                  {profile?.summary ? <p className="mt-3 whitespace-pre-line leading-6"><span className="font-semibold">Summary:</span> {profile.summary}</p> : null}
                  {profile?.skills.length ? <p className="mt-2 leading-6"><span className="font-semibold">Skills:</span> {profile.skills.join(", ")}</p> : null}
                </details>
              ) : null}
            </div>
            {canChange ? (
              <ActionForm action={updateApplicationStatus} className="flex flex-wrap items-center gap-2 md:justify-end">
                <input type="hidden" name="applicationId" value={application.id} />
                <label className="sr-only" htmlFor={`status-${application.id}`}>Update status for {application.candidate.fullName}</label>
                <select
                  id={`status-${application.id}`}
                  name="status"
                  defaultValue={application.status === "SUBMITTED" ? "REVIEWING" : application.status}
                  className={`${inputClass} w-auto min-w-40 py-2`}
                >
                  <option value="REVIEWING">Under review</option>
                  <option value="SHORTLISTED">Shortlisted</option>
                  <option value="HIRED">Hired</option>
                  <option value="REJECTED">Not selected</option>
                </select>
                <SubmitButton variant="secondary" className="px-4 py-2" pendingLabel="Saving…">Update</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-xs text-slate-500 md:text-right">Final decision recorded<br />{formatDate(application.updatedAt)}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
