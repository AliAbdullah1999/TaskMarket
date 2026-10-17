import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { applyToJob, closeJob, updateApplicationStatus } from "@/app/actions/jobs";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { FREE_APPLICATION_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatPKR } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const job = await prisma.job.findUnique({ where: { id }, select: { title: true } });
  return { title: job?.title ?? "Job" };
}

export default async function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const [user, job] = await Promise.all([
    getCurrentUser(),
    prisma.job.findUnique({
      where: { id },
      include: {
        employer: { select: { id: true, fullName: true, employerProfile: true } },
        _count: { select: { applications: true } },
      },
    }),
  ]);
  if (!job) notFound();

  const isOwner = user?.id === job.employerId;
  const [applications, myApplication] = await Promise.all([
    isOwner
      ? prisma.jobApplication.findMany({
          where: { jobId: job.id },
          orderBy: { createdAt: "desc" },
          include: { candidate: { select: { fullName: true, city: true, candidateProfile: true } } },
        })
      : Promise.resolve([]),
    user?.userType === "CANDIDATE"
      ? prisma.jobApplication.findUnique({
          where: { jobId_candidateId: { jobId: job.id, candidateId: user.id } },
          select: { id: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);
  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ? formatPKR(job.salaryMin) : "—"}${job.salaryMax ? ` – ${formatPKR(job.salaryMax)}` : ""} per month`
      : "Not disclosed";
  const expired = Boolean(job.expiresAt && job.expiresAt <= new Date());
  const open = job.status === "OPEN" && !expired;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/jobs" className="text-sm font-semibold text-emerald-700">← Browse jobs</Link>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={open ? "green" : "slate"}>{open ? "Accepting applications" : "Closed"}</Badge>
              <span className="text-sm text-slate-500">Posted {formatDate(job.createdAt)}</span>
            </div>
            <h1 className="mt-4 text-3xl font-black text-slate-950">{job.title}</h1>
            <p className="mt-2 text-lg font-semibold text-slate-800">{job.employer.employerProfile?.companyName ?? job.employer.fullName}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">{job.city}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{job.workplaceType.toLowerCase()}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{job.employmentType.replace("_", " ").toLowerCase()}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{job.category}</span>
            </div>
            <dl className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Monthly salary</dt><dd className="mt-1 font-semibold">{salary}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-slate-500">Applications</dt><dd className="mt-1 font-semibold">{job._count.applications}</dd></div>
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
            {isOwner && job.status === "OPEN" ? (
              <ActionForm action={closeJob} className="mt-8 border-t border-slate-100 pt-5">
                <input type="hidden" name="jobId" value={job.id} />
                <SubmitButton variant="secondary">Close this job listing</SubmitButton>
              </ActionForm>
            ) : null}
          </Card>

          {isOwner ? (
            <Card>
              <h2 className="text-lg font-bold">Applicants ({applications.length})</h2>
              {applications.length === 0 ? <p className="mt-3 text-sm text-slate-600">No applications yet.</p> : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {applications.map((application) => (
                    <li key={application.id} className="py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{application.candidate.fullName}</p>
                          <p className="text-sm text-slate-500">{application.candidate.candidateProfile?.headline ?? application.candidate.city ?? "Candidate"}</p>
                          <p className="mt-1 text-xs text-slate-500">Applied {formatDate(application.createdAt)}</p>
                        </div>
                        <Badge tone={application.status === "REJECTED" ? "red" : application.status === "HIRED" ? "green" : "slate"}>
                          {application.status.toLowerCase().replace("_", " ")}
                        </Badge>
                      </div>
                      {application.candidate.candidateProfile?.summary ? <p className="mt-3 text-sm text-slate-700">{application.candidate.candidateProfile.summary}</p> : null}
                      {application.candidate.candidateProfile?.skills.length ? (
                        <p className="mt-2 text-xs text-slate-500">Skills: {application.candidate.candidateProfile.skills.join(", ")}</p>
                      ) : null}
                      {application.coverLetter ? <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{application.coverLetter}</p> : null}
                      {["SUBMITTED", "REVIEWING", "SHORTLISTED"].includes(application.status) ? (
                        <ActionForm action={updateApplicationStatus} className="mt-4 flex flex-wrap gap-2">
                          <input type="hidden" name="applicationId" value={application.id} />
                          <select name="status" defaultValue={application.status === "SUBMITTED" ? "REVIEWING" : application.status} className={inputClass}>
                            <option value="REVIEWING">Reviewing</option>
                            <option value="SHORTLISTED">Shortlist</option>
                            <option value="HIRED">Hire</option>
                            <option value="REJECTED">Reject</option>
                          </select>
                          <SubmitButton variant="secondary">Update status</SubmitButton>
                        </ActionForm>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        <aside className="space-y-5">
          <Card>
            <p className="text-sm font-medium text-slate-500">Employer</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{job.employer.employerProfile?.companyName ?? job.employer.fullName}</p>
            {job.employer.employerProfile?.industry ? <p className="mt-1 text-sm text-slate-600">{job.employer.employerProfile.industry}</p> : null}
            {job.employer.employerProfile?.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{job.employer.employerProfile.description}</p> : null}
          </Card>
          {user?.userType === "CANDIDATE" ? (
            <Card>
              {myApplication ? (
                <p className="font-semibold text-emerald-800">You applied on {formatDate(myApplication.createdAt)}.</p>
              ) : open ? (
                <>
                  <h2 className="text-lg font-bold">Apply for this job</h2>
                  <p className="mt-1 text-sm text-slate-600">Free accounts can submit up to {FREE_APPLICATION_LIMIT} applications per month.</p>
                  <ActionForm action={applyToJob} className="mt-4 space-y-4">
                    <input type="hidden" name="jobId" value={job.id} />
                    <Field label="Cover letter" hint="Optional. Briefly explain why you are a good fit.">
                      <textarea name="coverLetter" rows={6} maxLength={3000} className={inputClass} />
                    </Field>
                    <SubmitButton className="w-full">Submit application</SubmitButton>
                  </ActionForm>
                </>
              ) : <p className="font-medium text-slate-700">This job is no longer accepting applications.</p>}
            </Card>
          ) : !user ? (
            <Card>
              <h2 className="text-lg font-bold">Interested in this role?</h2>
              <p className="mt-2 text-sm text-slate-600">Create a candidate account to apply and manage your applications.</p>
              <Link href={`/signup?role=CANDIDATE`} className="mt-4 inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">Join as a candidate</Link>
            </Card>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
