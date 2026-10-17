import type { Metadata } from "next";
import { reviewSubscription, setUserStatus } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, PageHeader, StatTile, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireUser(["ADMIN"]);
  const [subscriptions, users, candidateCount, employerCount, openJobs, totalApplications] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { fullName: true, email: true, userType: true } } },
    }),
    prisma.user.findMany({ where: { userType: { not: "ADMIN" } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.user.count({ where: { userType: "CANDIDATE" } }),
    prisma.user.count({ where: { userType: "EMPLOYER" } }),
    prisma.job.count({ where: { status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.jobApplication.count(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader eyebrow="Operations" title="Admin console" description="Monitor platform activity and review membership requests after verifying payment externally." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Candidates" value={candidateCount.toLocaleString()} />
        <StatTile label="Employers" value={employerCount.toLocaleString()} />
        <StatTile label="Open jobs" value={openJobs.toLocaleString()} />
        <StatTile label="Applications" value={totalApplications.toLocaleString()} />
      </div>

      <Card className="mt-8">
        <h2 className="text-lg font-bold">Membership requests ({subscriptions.length})</h2>
        <p className="mt-1 text-sm text-slate-600">Only activate a request after confirming the payment through your external payment channel.</p>
        {subscriptions.length === 0 ? <p className="mt-4 text-sm text-slate-500">No requests awaiting review.</p> : (
          <ul className="mt-4 divide-y divide-slate-100">
            {subscriptions.map((subscription) => (
              <li key={subscription.id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{subscription.user.fullName} <Badge tone="slate">{subscription.user.userType}</Badge></p>
                  <p className="text-sm text-slate-600">{subscription.user.email} · {subscription.plan.replace("_", " ")}</p>
                  <p className="mt-1 text-xs text-slate-500">Requested {formatDate(subscription.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <ActionForm action={reviewSubscription} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscriptionId" value={subscription.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <label className="block text-xs text-slate-600">
                      External payment reference
                      <input name="paymentReference" required minLength={3} maxLength={100} className={`${inputClass} mt-1 min-w-56`} />
                    </label>
                    <SubmitButton>Confirm and activate</SubmitButton>
                  </ActionForm>
                  <ActionForm action={reviewSubscription}>
                    <input type="hidden" name="subscriptionId" value={subscription.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <SubmitButton variant="danger">Reject request</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-8">
        <h2 className="text-lg font-bold">Newest accounts</h2>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-900">{user.fullName} <Badge tone="slate">{user.userType}</Badge> {user.status !== "ACTIVE" ? <Badge tone="red">{user.status}</Badge> : null}</p>
                <p className="text-slate-500">{user.email} · {user.city ?? "No location"} · joined {formatDate(user.createdAt)}</p>
              </div>
              <ActionForm action={setUserStatus}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="status" value={user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"} />
                <SubmitButton variant={user.status === "SUSPENDED" ? "secondary" : "danger"}>{user.status === "SUSPENDED" ? "Reactivate" : "Suspend"}</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
