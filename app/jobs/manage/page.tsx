import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Pagination, pageParam, paginate } from "@/components/pagination";
import { Badge, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { activeJobWhere, getEmployerJobAllowance } from "@/lib/entitlements";
import { formatDate, jobStatusMeta } from "@/lib/format";

export const metadata: Metadata = { title: "Manage jobs" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Open" },
  { value: "inactive", label: "Closed or expired" },
] as const;

export default async function ManageJobsPage(props: PageProps<"/jobs/manage">) {
  const user = await requireUser(["EMPLOYER"]);
  const params = await props.searchParams;
  const filter = FILTERS.find((item) => item.value === params.status)?.value ?? "";
  const now = new Date();
  const where: Prisma.JobWhereInput =
    filter === "active"
      ? { AND: [{ employerId: user.id }, activeJobWhere(now)] }
      : filter === "inactive"
        ? { employerId: user.id, NOT: activeJobWhere(now) }
        : { employerId: user.id };

  const [total, allowance] = await Promise.all([prisma.job.count({ where }), getEmployerJobAllowance(prisma, user.id, now)]);
  const { page, pageCount, skip, take } = paginate(total, pageParam(params.page), PAGE_SIZE);
  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
    include: {
      _count: { select: { applications: true } },
      applications: { where: { status: "SUBMITTED" }, select: { id: true } },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Hiring workspace"
        title="Manage jobs"
        description={`${allowance.active} of ${allowance.limit} active listing${allowance.limit === 1 ? "" : "s"} in use on ${allowance.isGrowth ? "Employer Growth" : "the free plan"}.`}
        action={allowance.canPublish ? <Link href="/jobs/new" className={buttonClass.primary}>Post a job</Link> : <Link href="/pricing" className={buttonClass.secondary}>Increase your limit</Link>}
      />
      <nav aria-label="Filter jobs" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={item.value ? `/jobs/manage?status=${item.value}` : "/jobs/manage"}
            aria-current={filter === item.value ? "page" : undefined}
            className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 aria-[current=page]:border-emerald-700 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-900"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {jobs.length === 0 ? (
        filter ? (
          <EmptyState title="No jobs in this view" description="Try another filter." href="/jobs/manage" cta="Show all jobs" />
        ) : (
          <EmptyState title="Start your hiring journey" description="Publish your first role to reach candidates and receive applications." href="/jobs/new" cta="Post a job" />
        )
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[24px] border border-[#e7eae5] bg-white shadow-[0_8px_28px_rgba(23,35,31,0.045)]">
          {jobs.map((job) => {
            const status = jobStatusMeta(job, now);
            const newCount = job.applications.length;
            return (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{job.title}</Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {newCount ? <Badge tone="amber">{newCount} new</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{job.city} · {job._count.applications} {job._count.applications === 1 ? "application" : "applications"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Posted {formatDate(job.createdAt)}{status.label === "Open" && job.expiresAt ? ` · closes ${formatDate(job.expiresAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/jobs/${job.id}`} className={buttonClass.secondary}>Review applicants</Link>
                  {job.status !== "ARCHIVED" ? <Link href={`/jobs/${job.id}/edit`} className={buttonClass.secondary}>Edit</Link> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath="/jobs/manage" page={page} pageCount={pageCount} params={{ status: filter }} />
    </main>
  );
}
