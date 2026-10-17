import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { getCurrentUser } from "@/lib/auth";
import { JOB_CATEGORIES } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function Home() {
  const [user, openJobs, employers, candidates, jobs] = await Promise.all([
    getCurrentUser(),
    prisma.job.count({ where: { status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.user.count({ where: { userType: "EMPLOYER" } }),
    prisma.user.count({ where: { userType: "CANDIDATE" } }),
    prisma.job.findMany({
      where: { status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        employer: { select: { fullName: true, employerProfile: { select: { companyName: true } } } },
        _count: { select: { applications: true } },
      },
    }),
  ]);
  const employer = user?.userType === "EMPLOYER";

  return (
    <main>
      <section className="bg-gradient-to-br from-emerald-50 via-white to-sky-50">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div>
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
              Careers and hiring across Pakistan
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
              Find work that moves your career forward.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Explore opportunities, present your skills, and apply in one place. Employers can reach talent and manage every application from a single dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/jobs" className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
                Explore jobs
              </Link>
              <Link
                href={employer ? "/jobs/new" : "/signup?role=EMPLOYER"}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {employer ? "Post a job" : "Hire talent"}
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500">Free to join · Paid plans for candidates and employers · Pakistan-focused</p>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5">
            <p className="text-sm font-semibold text-emerald-700">A clearer way to connect</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Your next opportunity starts here</h2>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Open jobs", openJobs.toLocaleString()],
                ["Hiring organizations", employers.toLocaleString()],
                ["Candidate profiles", candidates.toLocaleString()],
                ["Locations", "Nationwide"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-950">Built for both sides of hiring</p>
              <p className="mt-1 text-sm leading-6 text-emerald-900">Candidates manage applications and career profiles. Employers publish vacancies and review applicants.</p>
            </div>
          </div>
        </div>
      </section>

      {jobs.length ? (
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Recently posted</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Latest opportunities</h2>
            </div>
            <Link href="/jobs" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">View all jobs →</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-xl font-bold text-slate-900">Be among the first to post or apply</h2>
            <p className="mt-2 text-sm text-slate-600">Create a candidate profile or join as an employer to get started.</p>
            <Link href="/signup" className="mt-5 inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">Create an account</Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Explore by field</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Find roles in your industry</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Start with a field that matches your experience, then discover opportunities across Pakistan.</p>
          </div>
          <Link href="/jobs" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">Browse all jobs →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {JOB_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/jobs?category=${encodeURIComponent(category)}`}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
            >
              <span>{category}</span>
              <span aria-hidden="true" className="text-lg text-slate-400 group-hover:text-emerald-700">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">A clear path forward</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">One platform, two ways to move ahead</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Whether you&apos;re looking for your next role or building a team, get started in a few simple steps.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">For candidates</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">Take the next step in your career</h3>
            <ol className="mt-5 space-y-4">
              {[
                ["01", "Create your profile", "Share your experience and skills with a career profile."],
                ["02", "Explore open roles", "Search opportunities by title, field, or location."],
                ["03", "Apply and stay organized", "Submit applications and follow their progress from your dashboard."],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-800">{number}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href={user?.userType === "CANDIDATE" ? "/profile" : "/signup?role=CANDIDATE"} className="mt-6 inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              Build your profile
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">For employers</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">Find the people your team needs</h3>
            <ol className="mt-5 space-y-4">
              {[
                ["01", "Set up your company", "Create an employer account to manage your hiring."],
                ["02", "Publish a job", "Share the role, requirements, and location with candidates."],
                ["03", "Review applicants", "Keep applications moving from your hiring dashboard."],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-bold text-sky-800">{number}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href={employer ? "/jobs/new" : "/signup?role=EMPLOYER"} className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
              {employer ? "Post a job" : "Start hiring"}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-5 rounded-3xl bg-slate-900 p-8 text-white md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">For candidates</p>
            <h2 className="mt-2 text-2xl font-bold">Make your experience visible</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Build a profile, search relevant roles, and keep track of applications and outcomes.</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">For employers</p>
            <h2 className="mt-2 text-2xl font-bold">Reach people ready for their next role</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Publish vacancies and manage candidate review from a hiring dashboard.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
