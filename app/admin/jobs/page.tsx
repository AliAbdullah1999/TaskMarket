import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { removeJob } from "@/app/actions/admin";
import { ActionForm, ConfirmSubmitButton } from "@/components/action-form";
import { Pagination, pageParam, paginate } from "@/components/pagination";
import { Badge, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeJobWhere } from "@/lib/entitlements";
import { formatDate, jobStatusMeta } from "@/lib/format";

export const metadata: Metadata = { title: "Job listings" };

const FILTERS = [
  { value: "", label: "All listings" },
  { value: "active", label: "Open" },
  { value: "removed", label: "Removed" },
] as const;
const PAGE = 20;

export default async function AdminJobsPage(props: PageProps<"/admin/jobs">) {
  await requireUser(["ADMIN"]);
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const filter = FILTERS.find((item) => item.value === params.status)?.value ?? "";
  const now = new Date();

  const filters: Prisma.JobWhereInput[] = [];
  if (filter === "active") filters.push(activeJobWhere(now));
  if (filter === "removed") filters.push({ status: "ARCHIVED" });
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { employer: { email: { contains: q, mode: "insensitive" } } },
        { employer: { employerProfile: { companyName: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  const where: Prisma.JobWhereInput = { AND: filters };

  const total = await prisma.job.count({ where });
  const { page, pageCount, skip, take } = paginate(total, pageParam(params.page), PAGE);
  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
    select: {
      id: true,
      title: true,
      city: true,
      category: true,
      status: true,
      expiresAt: true,
      removedReason: true,
      createdAt: true,
      employer: { select: { fullName: true, email: true, status: true, employerProfile: { select: { companyName: true } } } },
      _count: { select: { applications: true } },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">← Admin console</Link>
      <PageHeader
        eyebrow="Operations"
        title="Job listings"
        description={`${total.toLocaleString()} matching listings. Remove listings that break the listing rules; the employer is emailed the reason and the action is logged.`}
      />
      <form className="mb-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} maxLength={100} placeholder="Title, description, company or employer email" aria-label="Search job listings" className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm sm:max-w-sm" />
        <select name="status" defaultValue={filter} aria-label="Status" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="submit" className="min-h-11 rounded-full bg-[#176b52] px-5 text-sm font-semibold text-white">Filter</button>
      </form>
      {jobs.length === 0 ? (
        <EmptyState title="No listings found" description="Try a different search or filter." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[24px] border border-[#e7eae5] bg-white">
          {jobs.map((job) => {
            const status = jobStatusMeta(job, now);
            return (
              <li key={job.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    <Link href={`/jobs/${job.id}`} className="hover:text-emerald-800">{job.title}</Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {job.employer.status !== "ACTIVE" ? <Badge tone="red">employer {job.employer.status.toLowerCase()}</Badge> : null}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {job.employer.employerProfile?.companyName ?? job.employer.fullName} · {job.employer.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {job.category} · {job.city} · posted {formatDate(job.createdAt)} · {job._count.applications} {job._count.applications === 1 ? "application" : "applications"}
                  </p>
                  {job.status === "ARCHIVED" ? <p className="mt-2 text-xs text-rose-800">Removal reason: {job.removedReason ?? "not recorded"}</p> : null}
                </div>
                {job.status !== "ARCHIVED" ? (
                  <ActionForm action={removeJob} className="space-y-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <label className="block text-xs font-medium text-slate-600">
                      Reason for removal (sent to the employer)
                      <input name="reason" required minLength={5} maxLength={500} placeholder="e.g. Asks candidates to pay a fee" className={`${inputClass} mt-1 py-2`} />
                    </label>
                    <ConfirmSubmitButton title="Remove this listing?" message={`"${job.title}" will be hidden from candidates and can no longer be edited or reopened. This cannot be undone.`} confirmLabel="Remove listing">
                      Remove listing
                    </ConfirmSubmitButton>
                  </ActionForm>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath="/admin/jobs" page={page} pageCount={pageCount} params={{ q, status: filter }} />
    </main>
  );
}
