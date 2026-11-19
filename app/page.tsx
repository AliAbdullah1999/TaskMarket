import Image from "next/image";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { JobCard } from "@/components/job-card";
import { getCurrentUser } from "@/lib/auth";
import { JOB_CATEGORIES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const [openJobs, employers, candidates, jobs] = await Promise.all([
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
  return (
    <main>
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#e7f1e9,_#fafbf8_58%,_#f1f5f0)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <span className="inline-flex rounded-full border border-emerald-900/10 bg-white/75 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-900 shadow-sm">
              Careers and hiring across Pakistan
            </span>
            <h1 className="mt-6 max-w-2xl text-[2.7rem] font-bold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[4.25rem]">
              Find work that moves your career forward.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Explore opportunities, present your skills, and apply in one place. Employers can reach talent and manage every application from a single dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/jobs" className="rounded-full bg-[#176b52] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-950/15 hover:-translate-y-0.5 hover:bg-[#10543f]">
                Explore jobs
              </Link>
              <Link
                href="/signup?role=EMPLOYER"
                className="rounded-full border border-slate-200/90 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white"
              >
                Hire talent
              </Link>
            </div>
            <p className="mt-5 text-xs font-medium tracking-wide text-slate-500">Free to join <span className="mx-1.5 text-emerald-700">·</span> Pakistan-focused <span className="mx-1.5 text-emerald-700">·</span> Built for both sides of hiring</p>
            <dl className="mt-9 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["Employers", employers.toLocaleString()],
                ["Candidates", candidates.toLocaleString()],
                ["Coverage", "Nationwide"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/80 bg-white/75 p-3.5 shadow-sm">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
                  <dd className="mt-1.5 text-lg font-bold tracking-tight text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-[580px] pb-6 pl-6 sm:pb-8 sm:pl-8">
            <div aria-hidden="true" className="absolute bottom-0 left-0 h-[85%] w-[85%] rounded-[32px] bg-[#d6e8dc]" />
            <Image
              src="/images/home-hero.jpg"
              alt="A young professional working on her laptop in a bright office"
              width={1400}
              height={788}
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="relative aspect-[4/3.4] w-full rounded-[28px] object-cover object-[35%_center] shadow-[0_24px_70px_rgba(29,55,43,0.18)]"
            />
            <div className="absolute right-3 top-6 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lg shadow-emerald-950/10 backdrop-blur sm:-right-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">✓</span>
              <span>
                <span className="block text-sm font-bold text-slate-900">Application shortlisted</span>
                <span className="block text-xs text-slate-500">Track every update in one place</span>
              </span>
            </div>
            <div className="absolute bottom-0 right-6 rounded-2xl bg-white/95 px-5 py-4 shadow-lg shadow-emerald-950/10 backdrop-blur sm:right-10">
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Open jobs now</span>
              <span className="mt-1 block text-2xl font-bold tracking-tight text-[#176b52]">{openJobs.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      {jobs.length ? (
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Recently posted</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Latest opportunities</h2>
            </div>
            <Link href="/jobs" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">View all jobs →</Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Be among the first to post or apply</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Create a candidate profile or join as an employer to get started.</p>
            <Link href="/signup" className="mt-6 inline-flex rounded-full bg-[#176b52] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#10543f]">Create an account</Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Explore by field</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Find roles in your industry</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Start with a field that matches your experience, then discover opportunities across Pakistan.</p>
          </div>
          <Link href="/jobs" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">Browse all jobs →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {JOB_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/jobs?category=${encodeURIComponent(category)}`}
              className="group flex items-center justify-between rounded-2xl border border-[#e7eae5] bg-white px-5 py-4 text-sm font-semibold text-slate-800 shadow-[0_4px_16px_rgba(23,35,31,0.035)] hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/70"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf5ef] text-emerald-800 group-hover:bg-white">
                  <CategoryIcon category={category} />
                </span>
                {category}
              </span>
              <span aria-hidden="true" className="text-lg text-slate-400 group-hover:text-emerald-700">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">A clear path forward</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">One platform, two ways to move ahead</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Whether you&apos;re looking for your next role or building a team, get started in a few simple steps.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-[#e7eae5] bg-white p-6 shadow-[0_8px_28px_rgba(23,35,31,0.045)] sm:p-7">
            <Image src="/images/home-candidates.jpg" alt="A candidate shaking hands with a hiring manager after an interview" width={1400} height={788} sizes="(min-width: 1024px) 560px, 100vw" className="mb-6 aspect-[16/9] w-full rounded-[18px] object-cover" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">For candidates</p>
            <h3 className="mt-3 text-xl font-bold tracking-tight text-slate-950">Take the next step in your career</h3>
            <ol className="mt-5 space-y-4">
              {[
                ["01", "Create your profile", "Share your experience and skills with a career profile."],
                ["02", "Explore open roles", "Search opportunities by title, field, or location."],
                ["03", "Apply and stay organized", "Submit applications and follow their progress from your dashboard."],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf5ef] text-xs font-bold text-emerald-900">{number}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/signup?role=CANDIDATE" className="mt-6 inline-flex rounded-full bg-[#176b52] px-5 py-3 text-sm font-semibold text-white hover:bg-[#10543f]">
              Build your profile
            </Link>
          </div>
          <div className="rounded-[24px] border border-[#e7eae5] bg-white p-6 shadow-[0_8px_28px_rgba(23,35,31,0.045)] sm:p-7">
            <Image src="/images/home-employers.jpg" alt="A hiring team collaborating around a table with laptops" width={1400} height={933} sizes="(min-width: 1024px) 560px, 100vw" className="mb-6 aspect-[16/9] w-full rounded-[18px] object-cover" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-800">For employers</p>
            <h3 className="mt-3 text-xl font-bold tracking-tight text-slate-950">Find the people your team needs</h3>
            <ol className="mt-5 space-y-4">
              {[
                ["01", "Set up your company", "Create an employer account to manage your hiring."],
                ["02", "Publish a job", "Share the role, requirements, and location with candidates."],
                ["03", "Review applicants", "Keep applications moving from your hiring dashboard."],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-bold text-sky-900">{number}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/signup?role=EMPLOYER" className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              Start hiring
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
