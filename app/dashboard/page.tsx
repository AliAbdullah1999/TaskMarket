import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { type CurrentUser, isCustomer, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAutoRelease } from "@/lib/escrow";
import { formatBudget, formatDate, formatPKR, payoutStatusMeta, quoteStatusMeta, taskStatusMeta } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.userType === "ADMIN") redirect("/admin");
  await runAutoRelease();

  return isCustomer(user) ? <CustomerDashboard user={user} /> : <TaskerDashboard user={user} />;
}

const ACTIVE_STATUSES = ["OPEN", "ASSIGNED", "ESCROW_ACTIVE", "IN_PROGRESS", "DISPUTED"] as const;

async function CustomerDashboard({ user }: { user: CurrentUser }) {
  const [tasks, spend] = await Promise.all([
    prisma.task.findMany({
      where: { customerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { quotes: { where: { status: "ACTIVE" } } } },
        tasker: { select: { fullName: true, businessName: true } },
        escrowTransaction: { select: { amount: true, status: true } },
      },
    }),
    prisma.escrowTransaction.aggregate({ where: { customerId: user.id, status: "RELEASED" }, _sum: { amount: true } }),
  ]);

  const active = tasks.filter((t) => (ACTIVE_STATUSES as readonly string[]).includes(t.status));
  const past = tasks.filter((t) => !(ACTIVE_STATUSES as readonly string[]).includes(t.status));
  const needsAction = tasks.filter(
    (t) => (t.status === "OPEN" && t._count.quotes > 0) || t.status === "ASSIGNED" || (t.status === "IN_PROGRESS" && t.taskerCompletedAt),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow={user.businessName ?? "Customer dashboard"}
        title={`Assalam-o-Alaikum, ${user.fullName.split(" ")[0]}`}
        action={
          <Link href="/tasks/new" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
            Post a task
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active tasks" value={String(active.length)} />
        <StatTile label="Needs your action" value={String(needsAction.length)} />
        <StatTile label="Completed" value={String(tasks.filter((t) => t.status === "COMPLETED").length)} />
        <StatTile label="Total spent" value={formatPKR(spend._sum.amount ?? 0)} />
      </div>

      {needsAction.length > 0 ? (
        <Card className="mt-8 border-amber-200 bg-amber-50/50">
          <h2 className="font-bold text-slate-900">Needs your attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {needsAction.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/tasks/${t.id}`} className="font-medium text-slate-900 hover:underline">
                  {t.title}
                </Link>
                <span className="text-amber-800">
                  {t.status === "OPEN"
                    ? `${t._count.quotes} quote${t._count.quotes === 1 ? "" : "s"} to review`
                    : t.status === "ASSIGNED"
                      ? "Fund escrow to start"
                      : "Confirm completion"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Active tasks</h2>
        {active.length === 0 ? (
          <EmptyState title="No active tasks" description="Post a task and verified taskers will start quoting." href="/tasks/new" cta="Post a task" />
        ) : (
          <TaskTable
            rows={active.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              meta: t.tasker ? (t.tasker.businessName ?? t.tasker.fullName) : `${t._count.quotes} quotes`,
              amount: t.escrowTransaction ? formatPKR(t.escrowTransaction.amount) : formatBudget(t.budgetMin, t.budgetMax),
              date: t.updatedAt,
            }))}
          />
        )}
      </section>

      {past.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-slate-900">History</h2>
          <TaskTable
            rows={past.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              meta: t.tasker ? (t.tasker.businessName ?? t.tasker.fullName) : "—",
              amount: t.escrowTransaction ? formatPKR(t.escrowTransaction.amount) : "—",
              date: t.updatedAt,
            }))}
          />
        </section>
      ) : null}
    </main>
  );
}

async function TaskerDashboard({ user }: { user: CurrentUser }) {
  const profile = user.taskerProfile;
  const [jobs, quotes, payouts, recommended] = await Promise.all([
    prisma.task.findMany({
      where: { taskerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { escrowTransaction: { select: { netAmount: true, status: true } } },
    }),
    prisma.quote.findMany({
      where: { taskerId: user.id, status: { in: ["ACTIVE", "REJECTED", "WITHDRAWN"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { task: { select: { id: true, title: true, city: true, status: true } } },
    }),
    prisma.payout.findMany({
      where: { taskerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { escrowTransaction: { select: { task: { select: { id: true, title: true } } } } },
    }),
    prisma.task.findMany({
      where: {
        status: "OPEN",
        quotes: { none: { taskerId: user.id } },
        ...(profile?.categories.length ? { category: { in: profile.categories } } : {}),
        ...(profile?.serviceAreas.length ? { city: { in: [...profile.serviceAreas, "Remote"] } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const earned = payouts.reduce((sum, p) => sum + p.netAmount, 0);
  const pendingPayout = payouts.filter((p) => p.status !== "PAID").reduce((sum, p) => sum + p.netAmount, 0);
  const activeJobs = jobs.filter((j) => (ACTIVE_STATUSES as readonly string[]).includes(j.status));
  const pastJobs = jobs.filter((j) => !(ACTIVE_STATUSES as readonly string[]).includes(j.status));

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Tasker dashboard"
        title={`Assalam-o-Alaikum, ${user.fullName.split(" ")[0]}`}
        action={
          <Link href="/tasks" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
            Find work
          </Link>
        }
      />

      {!profile?.ntin ? (
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <h2 className="font-bold text-amber-900">Add your NTN to start quoting</h2>
          <p className="mt-1 text-sm text-amber-800">FBR rules require every marketplace seller to have a verified NTN before receiving payments.</p>
          <Link href="/profile" className="mt-3 inline-flex rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white">
            Complete profile
          </Link>
        </Card>
      ) : !profile.ntinVerified ? (
        <Card className="mb-8 border-sky-200 bg-sky-50">
          <h2 className="font-bold text-sky-900">NTN verification in progress</h2>
          <p className="mt-1 text-sm text-sky-800">We&apos;re checking NTN {profile.ntin}. You&apos;ll be able to quote once it&apos;s approved.</p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active jobs" value={String(activeJobs.length)} />
        <StatTile label="Pending quotes" value={String(quotes.filter((q) => q.status === "ACTIVE").length)} />
        <StatTile label="Total earned (net)" value={formatPKR(earned)} />
        <StatTile label="Awaiting payout" value={formatPKR(pendingPayout)} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">Active jobs</h2>
            {activeJobs.length === 0 ? (
              <EmptyState title="No active jobs" description="When a customer accepts your quote, the job appears here." />
            ) : (
              <TaskTable
                rows={activeJobs.map((j) => ({
                  id: j.id,
                  title: j.title,
                  status: j.status,
                  meta: j.taskerCompletedAt ? "Awaiting confirmation" : j.city,
                  amount: j.escrowTransaction ? `${formatPKR(j.escrowTransaction.netAmount)} net` : "—",
                  date: j.updatedAt,
                }))}
              />
            )}
          </section>

          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">My quotes</h2>
            {quotes.length === 0 ? (
              <EmptyState title="No quotes yet" description="Browse open tasks in your categories and send your first quote." href="/tasks" cta="Browse tasks" />
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.1em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Task</th>
                      <th className="px-5 py-3">Quote</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quotes.map((q) => (
                      <tr key={q.id}>
                        <td className="px-5 py-3">
                          <Link href={`/tasks/${q.task.id}`} className="font-medium text-slate-900 hover:underline">
                            {q.task.title}
                          </Link>
                          <p className="text-xs text-slate-500">{q.task.city}</p>
                        </td>
                        <td className="px-5 py-3 font-semibold">{formatPKR(q.amountPKR)}</td>
                        <td className="px-5 py-3">
                          <Badge tone={quoteStatusMeta[q.status].tone}>{quoteStatusMeta[q.status].label}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {pastJobs.length > 0 ? (
            <section>
              <h2 className="mb-4 text-xl font-bold text-slate-900">Job history</h2>
              <TaskTable
                rows={pastJobs.map((j) => ({
                  id: j.id,
                  title: j.title,
                  status: j.status,
                  meta: j.city,
                  amount: j.escrowTransaction ? `${formatPKR(j.escrowTransaction.netAmount)} net` : "—",
                  date: j.completedAt ?? j.updatedAt,
                }))}
              />
            </section>
          ) : null}
        </div>

        <div className="space-y-8">
          <Card>
            <h2 className="font-bold text-slate-900">Recommended for you</h2>
            {recommended.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No new tasks match your categories and cities right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {recommended.map((t) => (
                  <li key={t.id} className="py-3">
                    <Link href={`/tasks/${t.id}`} className="font-medium text-slate-900 hover:underline">
                      {t.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {t.category} · {t.city} · {formatBudget(t.budgetMin, t.budgetMax)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="font-bold text-slate-900">Payouts</h2>
            {payouts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Released escrow payments show up here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{p.escrowTransaction.task.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatPKR(p.grossAmount)} − {formatPKR(p.commissionAmount)} fee · {formatDate(p.paidAt ?? p.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatPKR(p.netAmount)}</p>
                      <Badge tone={payoutStatusMeta[p.status].tone}>{payoutStatusMeta[p.status].label}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

function TaskTable({
  rows,
}: {
  rows: { id: string; title: string; status: keyof typeof taskStatusMeta; meta: string; amount: string; date: Date }[];
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.1em] text-slate-500">
          <tr>
            <th className="px-5 py-3">Task</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Amount</th>
            <th className="px-5 py-3">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-5 py-3">
                <Link href={`/tasks/${row.id}`} className="font-medium text-slate-900 hover:underline">
                  {row.title}
                </Link>
                <p className="text-xs text-slate-500">{row.meta}</p>
              </td>
              <td className="px-5 py-3">
                <Badge tone={taskStatusMeta[row.status].tone}>{taskStatusMeta[row.status].label}</Badge>
              </td>
              <td className="whitespace-nowrap px-5 py-3 font-semibold">{row.amount}</td>
              <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(row.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
