import type { Metadata } from "next";
import Link from "next/link";
import { reviewSubscription } from "@/app/actions/admin";
import { ActionForm, ConfirmSubmitButton, SubmitButton } from "@/components/action-form";
import { Badge, Card, PageHeader, StatTile, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeJobWhere, expireLapsedMemberships } from "@/lib/entitlements";
import { formatDate, planLabels } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

const actionLabels: Record<string, string> = {
  MEMBERSHIP_APPROVED: "Approved membership",
  MEMBERSHIP_REJECTED: "Rejected membership",
  ACCOUNT_SUSPENDED: "Suspended account",
  ACCOUNT_REACTIVATED: "Reactivated account",
  JOB_REMOVED: "Removed job listing",
};

export default async function AdminPage() {
  await requireUser(["ADMIN"]);
  const now = new Date();
  await expireLapsedMemberships(prisma, now);

  const [pending, candidateCount, employerCount, openJobs, totalApplications, activeMemberships, auditLog] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, fullName: true, email: true, userType: true, status: true } } },
    }),
    prisma.user.count({ where: { userType: "CANDIDATE" } }),
    prisma.user.count({ where: { userType: "EMPLOYER" } }),
    prisma.job.count({ where: activeJobWhere(now) }),
    prisma.jobApplication.count(),
    prisma.subscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: now }, OR: [{ currentPeriodStart: null }, { currentPeriodStart: { lte: now } }] },
    }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { admin: { select: { fullName: true } } } }),
  ]);

  // Members with a current membership of the same plan are renewals: approval extends from the current end date.
  const renewals = new Set(
    (
      await prisma.subscription.findMany({
        where: { userId: { in: pending.map((item) => item.userId) }, status: "ACTIVE", currentPeriodEnd: { gt: now } },
        select: { userId: true, plan: true },
      })
    ).map((item) => `${item.userId}:${item.plan}`),
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader eyebrow="Operations" title="Admin console" description="Platform activity at a glance. Approve membership requests only after confirming payment in your external payment channel." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Candidates" value={candidateCount.toLocaleString()} />
        <StatTile label="Employers" value={employerCount.toLocaleString()} />
        <StatTile label="Open jobs" value={openJobs.toLocaleString()} hint="Open and not expired" />
        <StatTile label="Applications" value={totalApplications.toLocaleString()} />
        <StatTile label="Pending requests" value={pending.length.toLocaleString()} />
        <StatTile label="Active memberships" value={activeMemberships.toLocaleString()} />
      </div>

      <Card className="mt-8 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Membership requests</h2>
          <div className="flex items-center gap-3">
            <Badge tone={pending.length ? "amber" : "slate"}>{pending.length} awaiting review</Badge>
            <Link href="/admin/memberships" className="text-sm font-semibold text-emerald-700 hover:underline">History →</Link>
          </div>
        </div>
        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No requests awaiting review.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {pending.map((request) => (
              <li key={request.id} className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {request.user.fullName}
                    <Badge tone="slate">{request.user.userType.toLowerCase()}</Badge>
                    {renewals.has(`${request.userId}:${request.plan}`) ? <Badge tone="blue">Renewal</Badge> : null}
                    {request.user.status !== "ACTIVE" ? <Badge tone="red">{request.user.status.toLowerCase()}</Badge> : null}
                  </p>
                  <p className="text-sm text-slate-600">{request.user.email} · {planLabels[request.plan]}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Requested {formatDate(request.createdAt, true)} · Member&apos;s reference: {request.requestedReference ?? "none provided"}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <ActionForm action={reviewSubscription} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscriptionId" value={request.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <label className="block text-xs font-medium text-slate-600">
                      Confirmed payment reference
                      <input name="paymentReference" required minLength={3} maxLength={100} defaultValue={request.requestedReference ?? ""} placeholder="External transaction ID" className={`${inputClass} mt-1 min-w-56 py-2`} />
                    </label>
                    <SubmitButton pendingLabel="Activating…">Confirm and activate</SubmitButton>
                  </ActionForm>
                  <ActionForm action={reviewSubscription} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscriptionId" value={request.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <label className="block text-xs font-medium text-slate-600">
                      Rejection reason (shown to member)
                      <input name="note" maxLength={500} placeholder="e.g. Payment not received" className={`${inputClass} mt-1 min-w-52 py-2`} />
                    </label>
                    <ConfirmSubmitButton title="Reject this request?" message={`${request.user.fullName}'s request for ${planLabels[request.plan]} will be rejected. They can submit a new request later.`} confirmLabel="Reject request">
                      Reject
                    </ConfirmSubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-8 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Recent administrative actions</h2>
          <div className="flex items-center gap-4">
            <Link href="/admin/jobs" className="text-sm font-semibold text-emerald-700 hover:underline">Moderate jobs →</Link>
            <Link href="/admin/accounts" className="text-sm font-semibold text-emerald-700 hover:underline">Manage accounts →</Link>
          </div>
        </div>
        {auditLog.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No administrative actions recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span><span className="font-semibold text-slate-900">{entry.admin.fullName}</span> · {actionLabels[entry.action] ?? entry.action} <span className="text-xs text-slate-400">({entry.targetType} {entry.targetId.slice(-6)})</span></span>
                <span className="text-xs text-slate-500">{formatDate(entry.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
