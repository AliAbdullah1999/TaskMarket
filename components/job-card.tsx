import Link from "next/link";
import { employmentLabels, formatDate, formatSalary, workplaceLabels } from "@/lib/format";

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

export function JobCard({ job }: { job: JobCardData }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax) ?? "Salary not listed";

  return (
    <article className="group rounded-[22px] border border-[#e7eae5] bg-white p-5 shadow-[0_5px_20px_rgba(23,35,31,0.04)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_14px_36px_rgba(23,35,31,0.09)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">{job.category}</p>
          <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
            <Link href={`/jobs/${job.id}`} className="group-hover:text-emerald-800">
              {job.title}
            </Link>
          </h2>
        </div>
        <span className="rounded-full bg-[#f3f5f1] px-3 py-1.5 text-xs font-semibold text-slate-600">
          {employmentLabels[job.employmentType] ?? job.employmentType}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-800">{job.employer.employerProfile?.companyName ?? job.employer.fullName}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
        <span>{job.city} · {workplaceLabels[job.workplaceType] ?? job.workplaceType}</span>
        <span className={job.salaryMin || job.salaryMax ? "font-medium text-slate-800" : "text-slate-500"}>{salary}</span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>Posted {formatDate(job.createdAt)}</span>
        {job._count ? <span>{job._count.applications} {job._count.applications === 1 ? "applicant" : "applicants"}</span> : null}
      </div>
    </article>
  );
}
