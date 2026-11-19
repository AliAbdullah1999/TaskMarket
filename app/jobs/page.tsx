import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { Pagination, pageParam, paginate } from "@/components/pagination";
import { EmptyState, PageHeader, inputClass } from "@/components/ui";
import { CITIES, JOB_CATEGORIES, PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { activeJobWhere } from "@/lib/entitlements";

export const metadata: Metadata = { title: "Find jobs" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function JobsPage(props: PageProps<"/jobs">) {
  const params = await props.searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const category = (JOB_CATEGORIES as readonly string[]).includes(one(params.category)) ? one(params.category) : "";
  const city = (CITIES as readonly string[]).includes(one(params.city)) ? one(params.city) : "";

  // Every filter is ANDed so they narrow results together.
  const filters: Prisma.JobWhereInput[] = [activeJobWhere(new Date())];
  if (category) filters.push({ category });
  if (city) filters.push({ city });
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { requirements: { contains: q, mode: "insensitive" } },
        { employer: { employerProfile: { companyName: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  const where: Prisma.JobWhereInput = { AND: filters };

  const total = await prisma.job.count({ where });
  const { page, pageCount, skip, take } = paginate(total, pageParam(params.page), PAGE_SIZE);
  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
    include: {
      employer: { select: { fullName: true, employerProfile: { select: { companyName: true } } } },
      _count: { select: { applications: true } },
    },
  });
  const filtered = Boolean(q || category || city);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Opportunities"
        title="Find your next role"
        description={`${total.toLocaleString()} ${filtered ? "matching" : "open"} ${total === 1 ? "job" : "jobs"} across Pakistan.`}
      />
      <form role="search" className="mb-8 grid gap-3 rounded-[24px] border border-[#e7eae5] bg-white p-4 shadow-[0_8px_28px_rgba(23,35,31,0.045)] sm:p-5 md:grid-cols-[2fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} maxLength={100} placeholder="Job title, skill, or company" className={inputClass} aria-label="Search jobs" />
        <select name="category" defaultValue={category} className={inputClass} aria-label="Job category">
          <option value="">All categories</option>
          {JOB_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select name="city" defaultValue={city} className={inputClass} aria-label="Location">
          <option value="">All locations</option>
          {CITIES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div className="flex items-center gap-3">
          {filtered ? <Link href="/jobs" className="text-sm font-semibold text-slate-500 hover:text-slate-900">Clear</Link> : null}
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-[#176b52] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#10543f]">Search jobs</button>
        </div>
      </form>
      {jobs.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      ) : filtered ? (
        <EmptyState title="No matching jobs" description="Try another keyword or location, or clear the filters." href="/jobs" cta="Clear filters" />
      ) : (
        <EmptyState title="No open jobs right now" description="New roles are posted regularly. Check back soon." />
      )}
      <Pagination basePath="/jobs" page={page} pageCount={pageCount} params={{ q, category, city }} />
    </main>
  );
}
