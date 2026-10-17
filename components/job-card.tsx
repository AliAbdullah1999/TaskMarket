import Link from "next/link";
import { formatDate, formatPKR } from "@/lib/format";

type JobCardData = {
  id: string;
  title: string;
  category: string;
  city: string;
  employmentType: string;
  workplaceType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: Date;
  employer: {
    fullName: string;
    employerProfile: { companyName: string } | null;
  };
  _count?: { applications: number };
};

const employmentLabels: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
};

export function JobCard({ job }: { job: JobCardData }) {
  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ? formatPKR(job.salaryMin) : "—"}${job.salaryMax ? ` – ${formatPKR(job.salaryMax)}` : ""} / month`
      : "Salary not listed";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{job.category}</p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">
            <Link href={`/jobs/${job.id}`} className="hover:text-emerald-700">
              {job.title}
            </Link>
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {employmentLabels[job.employmentType] ?? job.employmentType}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-800">{job.employer.employerProfile?.companyName ?? job.employer.fullName}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
        <span>{job.city} · {job.workplaceType.toLowerCase()}</span>
        <span>{salary}</span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>Posted {formatDate(job.createdAt)}</span>
        {job._count ? <span>{job._count.applications} applicants</span> : null}
      </div>
    </article>
  );
}
