import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LegacyAccountMigration } from "@/components/legacy-account-migration";
import { Badge, Card, EmptyState, PageHeader, StatTile, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { FREE_APPLICATION_LIMIT, GROWTH_ACTIVE_JOB_LIMIT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getCandidateApplicationAllowance, getEmployerJobAllowance, getMembershipOverview } from "@/lib/entitlements";
import { applicationStatusMeta, formatDate, jobStatusMeta } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

const sectionClass = "min-w-0 overflow-hidden rounded-[24px] border border-[#e7eae5] bg-white shadow-[0_8px_28px_rgba(23,35,31,0.045)]";

function SectionHeader({ title, description, href, cta }: { title: string; description: string; href: string; cta: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <Link href={href} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">{cta} →</Link>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.userType === "ADMIN") redirect("/admin");
  if (user.userType !== "CANDIDATE" && user.userType !== "EMPLOYER") return <LegacyAccountMigration user={user} />;
  const now = new Date();

  if (user.userType === "CANDIDATE") {
    const [profile, totalApplications, recent, allowance, membership] = await Promise.all([
      prisma.candidateProfile.findUnique({ where: { userId: user.id } }),
      prisma.jobApplication.count({ where: { candidateId: user.id } }),
      prisma.jobApplication.findMany({
        where: { candidateId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { job: { select: { id: true, title: true, city: true, employer: { select: { fullName: true, employerProfile: { select: { companyName: true } } } } } } },
      }),
      getCandidateApplicationAllowance(prisma, user.id, now),
      getMembershipOverview(prisma, user.id, "CANDIDATE_PRO", now),
    ]);
    const profileComplete = Boolean(profile?.headline && profile.summary && profile.skills.length);
    const planState = allowance.isPro ? "Pro" : membership.pending ? "Pending" : "Free";

    return (
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Candidate workspace"
          title={`Good to see you, ${user.fullName.split(" ")[0]}`}
          description="Your job search, applications, and career profile — together in one place."
          action={<Link href="/jobs" className={buttonClass.primary}>Explore jobs</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Applications" value={totalApplications.toLocaleString()} hint="All submitted applications" />
          <StatTile
            label="This month"
            value={allowance.isPro ? String(allowance.used) : `${allowance.used} / ${FREE_APPLICATION_LIMIT}`}
            hint={allowance.isPro ? "Unlimited with Pro" : `Resets ${formatDate(allowance.resetsAt)}`}
          />
          <StatTile label="Profile" value={profileComplete ? "Complete" : "In progress"} hint={profile?.isPublic ? "Visible to employers" : "Private to you"} />
          <StatTile label="Membership" value={planState} hint={allowance.isPro && membership.active?.currentPeriodEnd ? `Active until ${formatDate(membership.active.currentPeriodEnd)}` : "Upgrade any time"} />
        </div>

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className={sectionClass}>
            <SectionHeader title="Recent application activity" description="Latest updates on the roles you applied for." href="/applications" cta="All applications" />
            {recent.length === 0 ? (
              <div className="p-5"><EmptyState title="Your next opportunity starts here" description="Search open roles and apply when you find a good fit." href="/jobs" cta="Explore jobs" /></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((application) => {
                  const meta = applicationStatusMeta[application.status];
                  return (
                    <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                      <div className="min-w-0">
                        <Link href={`/jobs/${application.job.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{application.job.title}</Link>
                        <p className="mt-1 text-sm text-slate-600">{application.job.employer.employerProfile?.companyName ?? application.job.employer.fullName} · {application.job.city}</p>
                        <p className="mt-1 text-xs text-slate-500">Applied {formatDate(application.createdAt)} · updated {formatDate(application.updatedAt)}</p>
                      </div>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="space-y-5">
            <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
              <p className="text-sm font-semibold text-emerald-800">Career profile</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">{profileComplete ? "Your profile is ready to go" : "Make your profile stand out"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {profileComplete
                  ? profile?.isPublic ? "Employers with Employer Growth can find your profile." : "Your profile is private. Choose whether employers can find you."
                  : "Add your headline, experience, and skills to make a stronger first impression."}
              </p>
              <Link href="/profile" className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                {profileComplete ? "Manage profile" : "Complete profile"}
              </Link>
            </Card>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your plan</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{allowance.isPro ? "Candidate Pro" : "Candidate Free"}</h2>
                </div>
                <Badge tone={allowance.isPro ? "green" : membership.pending ? "amber" : "slate"}>{allowance.isPro ? "Active" : membership.pending ? "Request pending" : "Current"}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {allowance.isPro
                  ? "Apply to as many roles as you like."
                  : `${allowance.remaining} free application${allowance.remaining === 1 ? "" : "s"} remaining this month.`}
              </p>
              <Link href="/pricing" className="mt-4 inline-flex text-sm font-semibold text-emerald-700">{allowance.isPro ? "Manage membership" : "Explore Candidate Pro"} →</Link>
            </Card>
          </aside>
        </div>
      </main>
    );
  }

  const [profile, jobAllowance, totalApplications, needsReview, recentApplicants, recentJobs, membership] = await Promise.all([
    prisma.employerProfile.findUnique({ where: { userId: user.id } }),
    getEmployerJobAllowance(prisma, user.id, now),
    prisma.jobApplication.count({ where: { employerId: user.id } }),
    prisma.jobApplication.count({ where: { employerId: user.id, status: "SUBMITTED" } }),
    prisma.jobApplication.findMany({
      where: { employerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, createdAt: true, job: { select: { id: true, title: true } }, candidate: { select: { fullName: true, candidateProfile: { select: { headline: true } } } } },
    }),
    prisma.job.findMany({ where: { employerId: user.id }, orderBy: { updatedAt: "desc" }, take: 5, include: { _count: { select: { applications: true } } } }),
    getMembershipOverview(prisma, user.id, "EMPLOYER_GROWTH", now),
  ]);
  const companyComplete = Boolean(profile?.companyName && profile.industry && profile.description);
  const shortcuts = [
    { href: "/jobs/manage", label: "Manage jobs" },
    { href: "/jobs/new", label: "Create a job" },
    { href: "/applications", label: "Review applications" },
    { href: "/candidates", label: "Search candidates" },
    { href: "/profile", label: "Company profile" },
    { href: "/pricing", label: "Membership" },
    { href: "/account", label: "Account settings" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Hiring workspace"
        title={`Welcome, ${profile?.companyName ?? user.businessName ?? user.fullName}`}
        description="Manage your open roles, review applicants, and keep your hiring moving."
        action={jobAllowance.canPublish ? <Link href="/jobs/new" className={buttonClass.primary}>Post a job</Link> : null}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active jobs" value={`${jobAllowance.active} / ${jobAllowance.limit}`} hint={jobAllowance.isGrowth ? "Employer Growth" : "Free plan"} />
        <StatTile label="Applications" value={totalApplications.toLocaleString()} hint="Across all your jobs" />
        <StatTile label="Needs review" value={needsReview.toLocaleString()} hint="New, not yet reviewed" />
        <StatTile
          label="Membership"
          value={jobAllowance.isGrowth ? "Growth" : membership.pending ? "Pending" : "Free"}
          hint={jobAllowance.isGrowth && membership.active?.currentPeriodEnd ? `Active until ${formatDate(membership.active.currentPeriodEnd)}` : `Growth: up to ${GROWTH_ACTIVE_JOB_LIMIT} jobs + candidate search`}
        />
      </div>
      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className={sectionClass}>
            <SectionHeader title="Recent applicants" description="The newest candidates to apply to your jobs." href="/applications" cta="All applications" />
            {recentApplicants.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-600">Applicants will appear here as candidates apply to your open roles.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentApplicants.map((application) => {
                  const meta = applicationStatusMeta[application.status];
                  return (
                    <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{application.candidate.fullName}</p>
                        <p className="mt-1 text-sm text-slate-600">{application.candidate.candidateProfile?.headline ?? "Candidate"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          <Link className="text-emerald-700 hover:underline" href={`/jobs/${application.job.id}`}>{application.job.title}</Link> · {formatDate(application.createdAt)}
                        </p>
                      </div>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={sectionClass}>
            <SectionHeader title="Recent job activity" description="Your most recently updated listings." href="/jobs/manage" cta="Manage jobs" />
            {recentJobs.length === 0 ? (
              <div className="p-5"><EmptyState title="Start your hiring journey" description="Publish your first role to reach candidates and receive applications." href="/jobs/new" cta="Create a job listing" /></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentJobs.map((job) => {
                  const status = jobStatusMeta(job, now);
                  return (
                    <li key={job.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                      <div className="min-w-0">
                        <Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{job.title}</Link>
                        <p className="mt-1 text-sm text-slate-600">{job.city} · {job._count.applications} {job._count.applications === 1 ? "application" : "applications"}</p>
                        <p className="mt-1 text-xs text-slate-500">Posted {formatDate(job.createdAt)}</p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <Card className={companyComplete ? "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white" : "border-amber-200 bg-amber-50"}>
            <p className="text-sm font-semibold text-slate-600">Company profile</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">{companyComplete ? "Your organization is ready" : "Complete your organization profile"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {companyComplete ? "A clear company profile helps candidates understand who is hiring." : "Add your industry and company introduction to build candidate confidence."}
            </p>
            <Link href="/profile" className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              {companyComplete ? "Manage company profile" : "Complete profile"}
            </Link>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-slate-950">Hiring shortcuts</p>
            <nav aria-label="Hiring shortcuts" className="mt-3 grid gap-2">
              {shortcuts.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-xl bg-[#f5f7f3] px-4 py-3 text-sm font-medium text-slate-700 hover:bg-emerald-50">{item.label} →</Link>
              ))}
            </nav>
          </Card>
        </aside>
      </div>
    </main>
  );
}
