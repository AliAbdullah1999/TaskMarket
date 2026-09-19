import type { Metadata } from "next";
import Link from "next/link";
import { markPayoutPaid, resolveDispute, reviewNtn, setUserStatus } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, PageHeader, StatTile, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAutoRelease } from "@/lib/escrow";
import { getMonthlySellerSummary } from "@/lib/fbr-report";
import { formatDate, formatPKR, payoutStatusMeta } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage(props: PageProps<"/admin">) {
  await requireUser(["ADMIN"]);
  const { month } = await props.searchParams;
  const autoReleased = await runAutoRelease();

  const [pendingNtn, disputes, payouts, escrowHeld, commission, report, recentUsers, userCount, taskCount] = await Promise.all([
    prisma.taskerProfile.findMany({
      where: { ntin: { not: null }, ntinVerified: false },
      orderBy: { updatedAt: "asc" },
      include: { user: { select: { id: true, fullName: true, email: true, city: true, createdAt: true } } },
    }),
    prisma.escrowTransaction.findMany({
      where: { status: "DISPUTED" },
      orderBy: { createdAt: "asc" },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            customer: { select: { fullName: true } },
            tasker: { select: { fullName: true } },
            messages: { where: { channelType: "SYSTEM", body: { startsWith: "Dispute raised" } }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    }),
    prisma.payout.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      include: { tasker: { select: { fullName: true, email: true, taskerProfile: { select: { ntin: true } } } } },
    }),
    prisma.escrowTransaction.aggregate({ where: { status: { in: ["FUNDED", "DISPUTED"] } }, _sum: { amount: true } }),
    prisma.escrowTransaction.aggregate({ where: { status: "RELEASED" }, _sum: { commissionAmount: true } }),
    getMonthlySellerSummary(typeof month === "string" ? month : null),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, where: { userType: { not: "ADMIN" } } }),
    prisma.user.count(),
    prisma.task.count(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader eyebrow="Operations" title="Admin console" description={autoReleased ? `${autoReleased} escrow(s) auto-released on load.` : undefined} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Held in escrow" value={formatPKR(escrowHeld._sum.amount ?? 0)} />
        <StatTile label="Commission earned" value={formatPKR(commission._sum.commissionAmount ?? 0)} />
        <StatTile label="Users" value={userCount.toLocaleString()} />
        <StatTile label="Tasks" value={taskCount.toLocaleString()} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-slate-900">NTN verification queue ({pendingNtn.length})</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {pendingNtn.length === 0 ? <li className="py-3 text-sm text-slate-500">Queue is empty.</li> : null}
            {pendingNtn.map((profile) => (
              <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">{profile.user.fullName}</p>
                  <p className="text-slate-500">
                    {profile.user.email} · {profile.user.city}
                  </p>
                  <p className="mt-1 font-mono text-slate-800">NTN {profile.ntin}</p>
                </div>
                <div className="flex gap-2">
                  <ActionForm action={reviewNtn}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <SubmitButton>Approve</SubmitButton>
                  </ActionForm>
                  <ActionForm action={reviewNtn}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <SubmitButton variant="danger">Reject</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-900">Open disputes ({disputes.length})</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {disputes.length === 0 ? <li className="py-3 text-sm text-slate-500">No open disputes.</li> : null}
            {disputes.map((escrow) => (
              <li key={escrow.id} className="py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/tasks/${escrow.task.id}`} className="font-semibold text-slate-900 hover:underline">
                    {escrow.task.title}
                  </Link>
                  <span className="font-bold">{formatPKR(escrow.amount)}</span>
                </div>
                <p className="text-slate-500">
                  {escrow.task.customer.fullName} → {escrow.task.tasker?.fullName ?? "—"}
                </p>
                {escrow.task.messages[0] ? <p className="mt-2 rounded-xl bg-rose-50 p-3 text-rose-800">{escrow.task.messages[0].body}</p> : null}
                <ActionForm action={resolveDispute} className="mt-3 space-y-2">
                  <input type="hidden" name="escrowId" value={escrow.id} />
                  <input name="note" placeholder="Resolution note (shared with both parties)" className={inputClass} />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" name="outcome" value="release" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                      Release to tasker
                    </button>
                    <button type="submit" name="outcome" value="refund" className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">
                      Refund customer
                    </button>
                  </div>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Payout queue ({payouts.length})</h2>
        {payouts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No payouts waiting.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Tasker</th>
                  <th className="py-2 pr-4">NTN</th>
                  <th className="py-2 pr-4">Gross</th>
                  <th className="py-2 pr-4">Fee</th>
                  <th className="py-2 pr-4">Net</th>
                  <th className="py-2 pr-4">Queued</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{payout.tasker.fullName}</p>
                      <p className="text-xs text-slate-500">{payout.tasker.email}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono">{payout.tasker.taskerProfile?.ntin ?? "—"}</td>
                    <td className="py-3 pr-4">{formatPKR(payout.grossAmount)}</td>
                    <td className="py-3 pr-4">{formatPKR(payout.commissionAmount)}</td>
                    <td className="py-3 pr-4 font-semibold">{formatPKR(payout.netAmount)}</td>
                    <td className="py-3 pr-4">
                      {formatDate(payout.createdAt)} <Badge tone={payoutStatusMeta[payout.status].tone}>{payoutStatusMeta[payout.status].label}</Badge>
                    </td>
                    <td className="py-3">
                      <ActionForm action={markPayoutPaid}>
                        <input type="hidden" name="payoutId" value={payout.id} />
                        <SubmitButton variant="dark">Mark paid</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">FBR monthly seller summary</h2>
            <p className="text-sm text-slate-500">Gross sales, commission and net payout per NTN holder, from released escrows.</p>
          </div>
          <form className="flex items-center gap-2">
            <input type="month" name="month" defaultValue={report.month} className={inputClass} aria-label="Report month" />
            <button type="submit" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">
              View
            </button>
            <a href={`/api/admin/fbr-report?month=${report.month}`} className="whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
              Download CSV
            </a>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="py-2 pr-4">Seller</th>
                <th className="py-2 pr-4">NTN</th>
                <th className="py-2 pr-4">Txns</th>
                <th className="py-2 pr-4">Gross</th>
                <th className="py-2 pr-4">Commission</th>
                <th className="py-2">Net payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.sellers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-slate-500">
                    No released transactions in {report.month}.
                  </td>
                </tr>
              ) : null}
              {report.sellers.map((row) => (
                <tr key={row.sellerId}>
                  <td className="py-3 pr-4 font-medium">{row.name}</td>
                  <td className="py-3 pr-4 font-mono">{row.ntin ?? "—"}</td>
                  <td className="py-3 pr-4">{row.transactions}</td>
                  <td className="py-3 pr-4">{formatPKR(row.gross)}</td>
                  <td className="py-3 pr-4">{formatPKR(row.commission)}</td>
                  <td className="py-3 font-semibold">{formatPKR(row.net)}</td>
                </tr>
              ))}
            </tbody>
            {report.sellers.length > 0 ? (
              <tfoot className="border-t-2 border-slate-200 font-bold">
                <tr>
                  <td className="py-3 pr-4" colSpan={2}>Total</td>
                  <td className="py-3 pr-4">{report.totals.transactions}</td>
                  <td className="py-3 pr-4">{formatPKR(report.totals.gross)}</td>
                  <td className="py-3 pr-4">{formatPKR(report.totals.commission)}</td>
                  <td className="py-3">{formatPKR(report.totals.net)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Card>

      <Card className="mt-8">
        <h2 className="text-lg font-bold text-slate-900">Newest users</h2>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {recentUsers.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-900">
                  {u.fullName} <Badge tone="slate">{u.userType}</Badge>{" "}
                  {u.status !== "ACTIVE" ? <Badge tone="red">{u.status}</Badge> : null}
                </p>
                <p className="text-slate-500">
                  {u.email} · {u.city} · joined {formatDate(u.createdAt)}
                </p>
              </div>
              <ActionForm action={setUserStatus}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="status" value={u.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"} />
                <SubmitButton variant={u.status === "SUSPENDED" ? "secondary" : "danger"}>
                  {u.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
