import type { Metadata } from "next";
import type { Prisma, SubscriptionStatus } from "@prisma/client";
import Link from "next/link";
import { Pagination, pageParam, paginate } from "@/components/pagination";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { expireLapsedMemberships } from "@/lib/entitlements";
import { formatDate, membershipStatusMeta, planLabels } from "@/lib/format";

export const metadata: Metadata = { title: "Membership history" };

const STATUSES: SubscriptionStatus[] = ["REQUESTED", "ACTIVE", "EXPIRED", "REJECTED", "CANCELLED"];
const PAGE = 25;

export default async function AdminMembershipsPage(props: PageProps<"/admin/memberships">) {
  await requireUser(["ADMIN"]);
  await expireLapsedMemberships(prisma);
  const params = await props.searchParams;
  const status = STATUSES.find((value) => value === params.status) ?? "";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const where: Prisma.SubscriptionWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { user: { OR: [{ email: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }] } } : {}),
  };
  const total = await prisma.subscription.count({ where });
  const { page, pageCount, skip, take } = paginate(total, pageParam(params.page), PAGE);
  const rows = await prisma.subscription.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
    include: { user: { select: { fullName: true, email: true } }, reviewedBy: { select: { fullName: true } } },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">← Admin console</Link>
      <PageHeader eyebrow="Operations" title="Membership history" description={`${total.toLocaleString()} membership records.`} />
      <form className="mb-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Member name or email" aria-label="Search members" className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm sm:max-w-xs" />
        <select name="status" defaultValue={status} aria-label="Status" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((value) => <option key={value} value={value}>{membershipStatusMeta[value].label}</option>)}
        </select>
        <button type="submit" className="min-h-11 rounded-full bg-[#176b52] px-5 text-sm font-semibold text-white">Filter</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No membership records" description="Try a different filter." />
      ) : (
        <div className="overflow-x-auto rounded-[24px] border border-[#e7eae5] bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">Member</th>
                <th scope="col" className="px-4 py-3">Plan</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Requested</th>
                <th scope="col" className="px-4 py-3">Period</th>
                <th scope="col" className="px-4 py-3">References</th>
                <th scope="col" className="px-5 py-3">Reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const meta = membershipStatusMeta[row.status];
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-5 py-3"><p className="font-semibold text-slate-900">{row.user.fullName}</p><p className="text-xs text-slate-500">{row.user.email}</p></td>
                    <td className="px-4 py-3">{planLabels[row.plan]}</td>
                    <td className="px-4 py-3"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(row.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{row.currentPeriodStart ? `${formatDate(row.currentPeriodStart)} – ${formatDate(row.currentPeriodEnd)}` : "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <p>Member: {row.requestedReference ?? "—"}</p>
                      <p>Confirmed: {row.paymentReference ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {row.reviewedAt ? <p>{formatDate(row.reviewedAt)} by {row.reviewedBy?.fullName ?? "—"}</p> : "—"}
                      {row.reviewNote ? <p className="mt-1 text-slate-500">{row.reviewNote}</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/admin/memberships" page={page} pageCount={pageCount} params={{ q, status }} />
    </main>
  );
}
