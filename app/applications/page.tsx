import type { Metadata } from "next";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { APPLICANT_SELECT, ApplicantList } from "@/components/applicant-list";
import { Pagination, pageParam, paginate } from "@/components/pagination";
import { Badge, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { FREE_APPLICATION_LIMIT, PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getCandidateApplicationAllowance } from "@/lib/entitlements";
import { applicationStatusMeta, formatDate, jobStatusMeta } from "@/lib/format";

export const metadata: Metadata = { title: "Applications" };

const STATUS_FILTERS: { value: ApplicationStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "SUBMITTED", label: "New" },
  { value: "REVIEWING", label: "Under review" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "HIRED", label: "Hired" },
  { value: "REJECTED", label: "Not selected" },
];

function StatusFilter({ current, extra }: { current: string; extra: Record<string, string> }) {
  return (
    <nav aria-label="Filter by status" className="mb-5 flex flex-wrap gap-2">
      {STATUS_FILTERS.map((item) => {
        const query = new URLSearchParams({ ...extra, ...(item.value ? { status: item.value } : {}) }).toString();
        return (
          <Link
            key={item.value}
            href={query ? `/applications?${query}` : "/applications"}
            aria-current={current === item.value ? "page" : undefined}
            className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 aria-[current=page]:border-emerald-700 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-900"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function ApplicationsPage(props: PageProps<"/applications">) {
  const user = await requireUser(["CANDIDATE", "EMPLOYER"]);
  const params = await props.searchParams;
  const status = STATUS_FILTERS.find((item) => item.value && item.value === params.status)?.value || "";
  const requestedPage = pageParam(params.page);

  if (user.userType === "EMPLOYER") {
    const jobId = typeof params.job === "string" ? params.job : "";
    const jobs = await prisma.job.findMany({ where: { employerId: user.id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } });
    const validJob = jobs.some((job) => job.id === jobId) ? jobId : "";
    const where: Prisma.JobApplicationWhereInput = {
      employerId: user.id,
      ...(status ? { status } : {}),
      ...(validJob ? { jobId: validJob } : {}),
    };
    const total = await prisma.jobApplication.count({ where });
    const { page, pageCount, skip, take } = paginate(total, requestedPage, PAGE_SIZE);
    const applications = await prisma.jobApplication.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip, take, select: APPLICANT_SELECT });

    return (
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
        <PageHeader eyebrow="Hiring workspace" title="Applications" description="Every application to your job listings, newest first." />
        {jobs.length > 1 ? (
          <form className="mb-4 flex flex-wrap items-center gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <label htmlFor="job-filter" className="text-sm font-semibold text-slate-700">Job</label>
            <select id="job-filter" name="job" defaultValue={validJob} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">All jobs</option>
              {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
            <button type="submit" className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Apply filter</button>
          </form>
        ) : null}
        <StatusFilter current={status} extra={validJob ? { job: validJob } : {}} />
        <section className="overflow-hidden rounded-[24px] border border-[#e7eae5] bg-white shadow-[0_8px_28px_rgba(23,35,31,0.045)]">
          {applications.length ? (
            <ApplicantList applications={applications} showJob />
          ) : (
            <div className="p-5">
              <EmptyState
                title={status || validJob ? "No applications in this view" : "No applications yet"}
                description={status || validJob ? "Try another filter." : "Applications will appear here as candidates apply to your open roles."}
                href={jobs.length ? undefined : "/jobs/new"}
                cta={jobs.length ? undefined : "Post a job"}
              />
            </div>
          )}
        </section>
        <Pagination basePath="/applications" page={page} pageCount={pageCount} params={{ status, job: validJob }} />
      </main>
    );
  }

  const where: Prisma.JobApplicationWhereInput = { candidateId: user.id, ...(status ? { status } : {}) };
  const [total, allowance] = await Promise.all([prisma.jobApplication.count({ where }), getCandidateApplicationAllowance(prisma, user.id)]);
  const { page, pageCount, skip, take } = paginate(total, requestedPage, PAGE_SIZE);
  const applications = await prisma.jobApplication.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      job: {
        select: {
          id: true,
          title: true,
          city: true,
          status: true,
          expiresAt: true,
          employer: { select: { fullName: true, employerProfile: { select: { companyName: true } } } },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Candidate workspace"
        title="My applications"
        description={allowance.isPro ? "Candidate Pro: unlimited applications." : `${allowance.used} of ${FREE_APPLICATION_LIMIT} free applications used this month. Resets ${formatDate(allowance.resetsAt)}.`}
        action={<Link href="/jobs" className={buttonClass.primary}>Browse jobs</Link>}
      />
      <StatusFilter current={status} extra={{}} />
      {applications.length ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[24px] border border-[#e7eae5] bg-white shadow-[0_8px_28px_rgba(23,35,31,0.045)]">
          {applications.map((application) => {
            const meta = applicationStatusMeta[application.status];
            const jobStatus = jobStatusMeta(application.job);
            const changed = application.updatedAt.getTime() - application.createdAt.getTime() > 1000;
            return (
              <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                <div className="min-w-0">
                  <Link href={`/jobs/${application.job.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{application.job.title}</Link>
                  <p className="mt-1 text-sm text-slate-600">
                    {application.job.employer.employerProfile?.companyName ?? application.job.employer.fullName} · {application.job.city}
                    {jobStatus.label !== "Open" ? ` · listing ${jobStatus.label.toLowerCase()}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Applied {formatDate(application.createdAt)}{changed ? ` · status updated ${formatDate(application.updatedAt)}` : ""}
                  </p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={status ? "No applications with this status" : "You haven't applied yet"}
          description={status ? "Try another filter." : "Search open roles and apply when you find a good fit."}
          href="/jobs"
          cta="Explore jobs"
        />
      )}
      <Pagination basePath="/applications" page={page} pageCount={pageCount} params={{ status }} />
    </main>
  );
}
