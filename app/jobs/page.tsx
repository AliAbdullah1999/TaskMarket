import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { JobCard } from "@/components/job-card";
import { EmptyState, PageHeader, inputClass } from "@/components/ui";
import { CITIES, JOB_CATEGORIES } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Find jobs" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function JobsPage(props: PageProps<"/jobs">) {
  const params = await props.searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const category = one(params.category);
  const city = one(params.city);
  const where: Prisma.JobWhereInput = {
    status: "OPEN" as const,
    ...(category && (JOB_CATEGORIES as readonly string[]).includes(category) ? { category } : {}),
    ...(city ? { city } : {}),
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        employer: { select: { fullName: true, employerProfile: { select: { companyName: true } } } },
        _count: { select: { applications: true } },
      },
    }),
    prisma.job.count({ where }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader eyebrow="Opportunities" title="Find your next role" description={`${total} open ${total === 1 ? "job" : "jobs"} across Pakistan.`} />
      <form className="mb-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Job title, skills, or keyword" className={inputClass} aria-label="Search jobs" />
        <select name="category" defaultValue={category} className={inputClass} aria-label="Job category">
          <option value="">All categories</option>
          {JOB_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select name="city" defaultValue={city} className={inputClass} aria-label="Location">
          <option value="">All locations</option>
          {CITIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Search jobs</button>
      </form>
      {jobs.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      ) : (
        <EmptyState title="No matching jobs" description="Try another keyword or location, or clear the filters." href="/jobs" cta="Clear filters" />
      )}
    </main>
  );
}
