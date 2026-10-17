import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { LegacyAccountMigration } from "@/components/legacy-account-migration";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.userType === "ADMIN") redirect("/admin");
  if (user.userType !== "CANDIDATE" && user.userType !== "EMPLOYER") {
    return <LegacyAccountMigration user={user} />;
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id, status: { in: ["REQUESTED", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
  });

  if (user.userType === "CANDIDATE") {
    const [profile, applications, thisMonthCount] = await Promise.all([
      prisma.candidateProfile.findUnique({ where: { userId: user.id } }),
      prisma.jobApplication.findMany({
        where: { candidateId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          job: {
            include: {
              employer: {
                select: { fullName: true, employerProfile: { select: { companyName: true } } },
              },
            },
          },
        },
      }),
      prisma.jobApplication.count({
        where: {
          candidateId: user.id,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          status: { not: "WITHDRAWN" },
        },
      }),
    ]);
    const hasPro = subscription?.status === "ACTIVE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date();
    const statusTone = (status: string) =>
      status === "HIRED" || status === "SHORTLISTED"
        ? "green"
        : status === "REJECTED"
          ? "red"
          : status === "REVIEWING"
            ? "blue"
            : "slate";
    const profileComplete = Boolean(profile?.headline && profile.summary && profile.skills.length);

    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader
          eyebrow="Candidate workspace"
          title={`Good to see you, ${user.fullName.split(" ")[0]}`}
          description="Your job search, applications, and career profile—together in one place."
          action={<Link href="/jobs" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">Explore jobs</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Applications" value={String(applications.length)} hint="All submitted applications" />
          <StatTile label="This month" value={String(thisMonthCount)} hint={hasPro ? "Unlimited with Pro" : "3 applications on Free"} />
          <StatTile label="Profile" value={profileComplete ? "Complete" : "In progress"} hint={profile?.isPublic ? "Visible to employers" : "Private to you"} />
          <StatTile label="Membership" value={hasPro ? "Pro" : subscription?.status === "REQUESTED" ? "Pending" : "Free"} hint={hasPro ? "Active plan" : "Upgrade any time"} />
        </div>

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Recent applications</h2>
                <p className="mt-1 text-sm text-slate-500">Stay up to date on the roles you’ve applied for.</p>
              </div>
              <Link href="/jobs" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">Browse jobs →</Link>
            </div>
            {applications.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Your next opportunity starts here" description="Search open roles and apply when you find a good fit." href="/jobs" cta="Explore jobs" />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {applications.map((application) => (
                  <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                    <div className="min-w-0">
                      <Link href={`/jobs/${application.jobId}`} className="font-semibold text-slate-900 hover:text-emerald-700">{application.job.title}</Link>
                      <p className="mt-1 text-sm text-slate-600">{application.job.employer.employerProfile?.companyName ?? application.job.employer.fullName} · {application.job.city}</p>
                      <p className="mt-1 text-xs text-slate-500">Applied {formatDate(application.createdAt)}</p>
                    </div>
                    <Badge tone={statusTone(application.status)}>{application.status.toLowerCase().replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-5">
            <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
              <p className="text-sm font-semibold text-emerald-800">Career profile</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">{profileComplete ? "Your profile is ready to go" : "Make your profile stand out"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {profileComplete
                  ? profile?.isPublic ? "Employers can discover your profile." : "Your details are private. Choose if you want employers to find you."
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
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{hasPro ? "Candidate Pro" : "Free"}</h2>
                </div>
                <Badge tone={hasPro ? "green" : subscription?.status === "REQUESTED" ? "amber" : "slate"}>
                  {hasPro ? "Active" : subscription?.status === "REQUESTED" ? "Pending" : "Current"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {hasPro ? "Apply to as many roles as you like." : `${Math.max(0, 3 - thisMonthCount)} free application${3 - thisMonthCount === 1 ? "" : "s"} remaining this month.`}
              </p>
              {!hasPro && subscription?.status !== "REQUESTED" ? (
                <Link href="/pricing" className="mt-4 inline-flex text-sm font-semibold text-emerald-700">Explore Candidate Pro →</Link>
              ) : null}
            </Card>
          </aside>
        </div>
      </main>
    );
  }

  const [profile, jobs, applications, activeJobs] = await Promise.all([
    prisma.employerProfile.findUnique({ where: { userId: user.id } }),
    prisma.job.findMany({ where: { employerId: user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { applications: true } } } }),
    prisma.jobApplication.findMany({
      where: { employerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { job: { select: { id: true, title: true } }, candidate: { select: { fullName: true, candidateProfile: { select: { headline: true } } } } },
    }),
    prisma.job.count({
      where: { employerId: user.id, status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    }),
  ]);
  const hasGrowth = subscription?.status === "ACTIVE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date();
  const pendingReview = applications.filter((item) => item.status === "SUBMITTED").length;
  const companyComplete = Boolean(profile?.companyName && profile.industry && profile.description);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Hiring workspace"
        title={`Welcome, ${user.businessName ?? user.fullName}`}
        description="Manage your open roles, review applicants, and keep your hiring moving."
        action={<Link href="/jobs/new" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">Post a job</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active jobs" value={String(activeJobs)} hint={hasGrowth ? "Up to 5 with Growth" : "1 included on Free"} />
        <StatTile label="Applications" value={String(applications.length)} hint="Across your latest roles" />
        <StatTile label="Needs review" value={String(pendingReview)} hint="New applications" />
        <StatTile label="Membership" value={hasGrowth ? "Growth" : subscription?.status === "REQUESTED" ? "Pending" : "Free"} hint={hasGrowth ? "Active plan" : "Upgrade to grow"} />
      </div>
      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Your job listings</h2>
                <p className="mt-1 text-sm text-slate-500">Track listing activity and application volume.</p>
              </div>
              <Link href="/jobs/new" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">+ Post a job</Link>
            </div>
            {jobs.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Start your hiring journey" description="Publish your first role to reach candidates and receive applications." href="/jobs/new" cta="Create a job listing" />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                    <div className="min-w-0">
                      <Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{job.title}</Link>
                      <p className="mt-1 text-sm text-slate-600">{job.city} · {job._count.applications} applications</p>
                      <p className="mt-1 text-xs text-slate-500">Posted {formatDate(job.createdAt)}</p>
                    </div>
                    <Badge tone={job.status === "OPEN" && (!job.expiresAt || job.expiresAt > new Date()) ? "green" : "slate"}>
                      {job.status === "OPEN" && job.expiresAt && job.expiresAt <= new Date() ? "expired" : job.status.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Recent applicants</h2>
                <p className="mt-1 text-sm text-slate-500">Review candidates who have applied to your jobs.</p>
              </div>
              {pendingReview ? <Badge tone="amber">{pendingReview} new</Badge> : null}
            </div>
            {applications.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-600">Applicants will appear here as candidates apply to your open roles.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {applications.slice(0, 8).map((application) => (
                  <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{application.candidate.fullName}</p>
                      <p className="mt-1 text-sm text-slate-600">{application.candidate.candidateProfile?.headline ?? "Candidate"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        <Link className="text-emerald-700 hover:underline" href={`/jobs/${application.job.id}`}>{application.job.title}</Link> · {formatDate(application.createdAt)}
                      </p>
                    </div>
                    <Link href={`/jobs/${application.job.id}`} className="text-sm font-semibold text-emerald-700">Review →</Link>
                  </li>
                ))}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hiring plan</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{hasGrowth ? "Employer Growth" : "Free"}</h2>
              </div>
              <Badge tone={hasGrowth ? "green" : subscription?.status === "REQUESTED" ? "amber" : "slate"}>
                {hasGrowth ? "Active" : subscription?.status === "REQUESTED" ? "Pending" : "Current"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {hasGrowth ? `${Math.max(0, 5 - activeJobs)} active job slots available.` : activeJobs ? "Your free active job slot is in use." : "One active job listing is included."}
            </p>
            <Link href="/pricing" className="mt-4 inline-flex text-sm font-semibold text-emerald-700">View employer plans →</Link>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-slate-950">Hiring shortcuts</p>
            <div className="mt-3 grid gap-2">
              <Link href="/jobs/new" className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-emerald-50">Create a job listing →</Link>
              <Link href="/candidates" className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-emerald-50">Search candidate profiles →</Link>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
