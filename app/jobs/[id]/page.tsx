import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removeJob } from "@/app/actions/admin";
import { applyToJob, closeJob } from "@/app/actions/jobs";
import { ActionForm, ConfirmSubmitButton, SubmitButton } from "@/components/action-form";
import { APPLICANT_SELECT, ApplicantList } from "@/components/applicant-list";
import { Badge, Card, Field, Notice, buttonClass, inputClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { FREE_APPLICATION_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getCandidateApplicationAllowance, isJobAcceptingApplications } from "@/lib/entitlements";
import { applicationStatusMeta, employmentLabels, formatDate, formatSalary, jobStatusMeta, workplaceLabels } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const job = await prisma.job.findUnique({ where: { id }, select: { title: true, status: true, employer: { select: { status: true } } } });
  // Removed listings and listings of suspended employers do not reveal their title.
  return { title: job && job.status !== "ARCHIVED" && job.employer.status === "ACTIVE" ? job.title : "Job" };
}

const notices: Record<string, string> = {
  published: "Your job is live. It will accept applications for 30 days unless you close it sooner.",
  updated: "Job listing updated.",
};

export default async function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const { notice } = await props.searchParams;
  const [user, job] = await Promise.all([
    getCurrentUser(),
    prisma.job.findUnique({
      where: { id },
      include: {
        employer: { select: { id: true, fullName: true, status: true, employerProfile: true } },
        _count: { select: { applications: true } },
      },
    }),
  ]);
  if (!job) notFound();

  const now = new Date();
  const isOwner = user?.userType === "EMPLOYER" && user.id === job.employerId;
  const isCandidate = user?.userType === "CANDIDATE";
  const isAdmin = user?.userType === "ADMIN";
  const [applications, myApplication, allowance, invitation] = await Promise.all([
    isOwner ? prisma.jobApplication.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "desc" }, select: APPLICANT_SELECT }) : null,
    isCandidate
      ? prisma.jobApplication.findUnique({
          where: { jobId_candidateId: { jobId: job.id, candidateId: user.id } },
          select: { createdAt: true, updatedAt: true, status: true },
        })
      : null,
    isCandidate ? getCandidateApplicationAllowance(prisma, user.id, now) : null,
    isCandidate
      ? prisma.jobInvitation.findUnique({
          where: { jobId_candidateId: { jobId: job.id, candidateId: user.id } },
          select: { message: true, createdAt: true },
        })
      : null,
  ]);

  // Listings removed by an administrator, or whose employer is suspended, are hidden from
  // everyone except the owner, administrators and candidates who already applied.
  const hidden = job.status === "ARCHIVED" || job.employer.status !== "ACTIVE";
  if (hidden && !isOwner && !isAdmin && !myApplication) notFound();

  const open = !hidden && isJobAcceptingApplications(job, now);
  const status = jobStatusMeta(job, now);
  const salary = formatSalary(job.salaryMin, job.salaryMax, " per month") ?? "Not disclosed";
  const company = job.employer.employerProfile?.companyName ?? job.employer.fullName;
  const noticeText = typeof notice === "string" && isOwner ? notices[notice] : undefined;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href={isOwner ? "/jobs/manage" : "/jobs"} className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 hover:text-emerald-950">
        ← {isOwner ? "Manage jobs" : "Browse jobs"}
      </Link>
      {noticeText ? <Notice tone="success" className="mt-4">{noticeText}</Notice> : null}
      {job.status === "ARCHIVED" && (isOwner || isAdmin) ? (
        <Notice tone="error" title="This listing was removed by our team" className="mt-4">
          Reason: {job.removedReason ?? "It did not meet our listing rules."} It is no longer visible to candidates and cannot be edited or reopened.
        </Notice>
      ) : null}
      {isAdmin && job.employer.status !== "ACTIVE" ? (
        <Notice tone="warning" className="mt-4">The employer account is {job.employer.status.toLowerCase()}, so this listing is hidden from the public.</Notice>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={status.tone}>{open ? "Accepting applications" : status.label}</Badge>
              <span className="text-sm text-slate-500">Posted {formatDate(job.createdAt)}</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{job.title}</h1>
            <p className="mt-2 text-lg font-semibold text-slate-800">{company}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
              {[job.city, workplaceLabels[job.workplaceType], employmentLabels[job.employmentType], job.category].map((tag) => (
                <span key={tag} className="rounded-full bg-[#f3f5f1] px-3 py-1.5 text-xs font-medium">{tag}</span>
              ))}
            </div>
            <dl className="mt-6 grid gap-4 rounded-2xl border border-[#edf0eb] bg-[#f8faf7] p-4 sm:grid-cols-3">
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Monthly salary</dt><dd className="mt-1 font-semibold">{salary}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Applications</dt><dd className="mt-1 font-semibold">{job._count.applications}</dd></div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{open ? "Closes" : "Status"}</dt>
                <dd className="mt-1 font-semibold">{open ? formatDate(job.expiresAt) : status.label}</dd>
              </div>
            </dl>
            <section className="mt-8">
              <h2 className="text-lg font-bold">About the role</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{job.description}</p>
            </section>
            {job.requirements ? (
              <section className="mt-8">
                <h2 className="text-lg font-bold">Requirements</h2>
                <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{job.requirements}</p>
              </section>
            ) : null}
            {isOwner ? (
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                {job.status !== "ARCHIVED" ? <Link href={`/jobs/${job.id}/edit`} className={buttonClass.secondary}>Edit listing</Link> : null}
                {job.status === "OPEN" ? (
                  <ActionForm action={closeJob}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <ConfirmSubmitButton
                      title="Close this job listing?"
                      message="Candidates will no longer be able to apply. Existing applications stay available for review. This cannot be undone."
                      confirmLabel="Close listing"
                    >
                      Close listing
                    </ConfirmSubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            ) : null}
          </Card>

          {applications ? (
            <section className="overflow-hidden rounded-[24px] border border-[#e7eae5] bg-white shadow-[0_8px_28px_rgba(23,35,31,0.045)]">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <h2 className="text-lg font-bold">Applicants ({applications.length})</h2>
                <p className="mt-1 text-sm text-slate-500">Hired and not-selected decisions are final.</p>
              </div>
              {applications.length ? <ApplicantList applications={applications} /> : <p className="px-6 py-8 text-sm text-slate-600">No applications yet.</p>}
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <Card>
            <p className="text-sm font-medium text-slate-500">Employer</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{company}</p>
            {job.employer.employerProfile?.industry ? <p className="mt-1 text-sm text-slate-600">{job.employer.employerProfile.industry}</p> : null}
            {job.employer.employerProfile?.description ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{job.employer.employerProfile.description}</p> : null}
            {job.employer.employerProfile?.website ? (
              <a href={job.employer.employerProfile.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex text-sm font-semibold text-emerald-800 hover:underline">
                Company website ↗
              </a>
            ) : null}
          </Card>

          {isCandidate && allowance ? (
            <Card>
              {myApplication ? (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-emerald-900">You applied on {formatDate(myApplication.createdAt)}.</p>
                    <Badge tone={applicationStatusMeta[myApplication.status].tone}>{applicationStatusMeta[myApplication.status].label}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Last updated {formatDate(myApplication.updatedAt)}</p>
                  <Link href="/applications" className="mt-3 inline-flex text-sm font-semibold text-emerald-800 hover:underline">View my applications →</Link>
                </div>
              ) : !open ? (
                <p className="font-medium text-slate-700">This job is no longer accepting applications.</p>
              ) : !allowance.canApply ? (
                <Notice tone="warning" title="Monthly application limit reached">
                  You have used your {FREE_APPLICATION_LIMIT} free applications this month. Your allowance resets on {formatDate(allowance.resetsAt)}, or upgrade to Candidate Pro for unlimited applications.
                  <Link href="/pricing" className={`${buttonClass.primary} mt-3`}>Explore Candidate Pro</Link>
                </Notice>
              ) : (
                <>
                  {invitation ? (
                    <Notice tone="success" title={`${company} invited you to apply`} className="mb-4">
                      {invitation.message ? <span className="whitespace-pre-line">{invitation.message}</span> : `Invited on ${formatDate(invitation.createdAt)}.`}
                    </Notice>
                  ) : null}
                  <h2 className="text-lg font-bold tracking-tight text-slate-950">Apply for this job</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {allowance.isPro
                      ? "Candidate Pro: unlimited applications."
                      : `${allowance.remaining} of ${FREE_APPLICATION_LIMIT} free applications left this month.`}
                  </p>
                  <ActionForm action={applyToJob} className="mt-4 space-y-4" resetOnSuccess>
                    <input type="hidden" name="jobId" value={job.id} />
                    <Field label="Cover letter" hint="Optional. Briefly explain why you are a good fit (up to 3,000 characters).">
                      <textarea name="coverLetter" rows={6} maxLength={3000} className={inputClass} />
                    </Field>
                    <p className="text-xs leading-5 text-slate-500">
                      {company} will see your name, email, city, career profile and cover letter. Your phone number is not shared.
                    </p>
                    <SubmitButton className="w-full" pendingLabel="Submitting…">Submit application</SubmitButton>
                  </ActionForm>
                </>
              )}
            </Card>
          ) : isAdmin && job.status !== "ARCHIVED" ? (
            <Card className="border-rose-200">
              <h2 className="text-lg font-bold text-rose-900">Moderation</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Remove this listing if it breaks the listing rules. The employer is emailed the reason.</p>
              <ActionForm action={removeJob} className="mt-4 space-y-3">
                <input type="hidden" name="jobId" value={job.id} />
                <Field label="Reason for removal">
                  <textarea name="reason" rows={3} required minLength={5} maxLength={500} className={inputClass} placeholder="e.g. Asks candidates to pay a fee" />
                </Field>
                <ConfirmSubmitButton title="Remove this listing?" message="It will be hidden from candidates and can no longer be edited or reopened. This cannot be undone." confirmLabel="Remove listing">
                  Remove listing
                </ConfirmSubmitButton>
              </ActionForm>
            </Card>
          ) : !user && open ? (
            <Card>
              <h2 className="text-lg font-bold">Interested in this role?</h2>
              <p className="mt-2 text-sm text-slate-600">Create a free candidate account to apply and track your applications.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/signup?role=CANDIDATE" className={buttonClass.primary}>Join as a candidate</Link>
                <Link href={`/login?next=/jobs/${job.id}`} className={buttonClass.secondary}>Log in</Link>
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
