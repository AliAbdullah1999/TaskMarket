import type { Metadata } from "next";
import type { Prisma, UserType } from "@prisma/client";
import Link from "next/link";
import { setUserStatus } from "@/app/actions/admin";
import { ActionForm, ConfirmSubmitButton } from "@/components/action-form";
import { Pagination, pageParam, paginate } from "@/components/pagination";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, membershipStatusMeta, planLabels } from "@/lib/format";

export const metadata: Metadata = { title: "Accounts" };

const ROLES: { value: UserType; label: string }[] = [
  { value: "CANDIDATE", label: "Candidates" },
  { value: "EMPLOYER", label: "Employers" },
  { value: "ADMIN", label: "Administrators" },
];
const PAGE = 20;

export default async function AdminAccountsPage(props: PageProps<"/admin/accounts">) {
  const admin = await requireUser(["ADMIN"]);
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const role = ROLES.find((item) => item.value === params.role)?.value ?? "";
  const status = params.status === "SUSPENDED" || params.status === "ACTIVE" ? params.status : "";
  const where: Prisma.UserWhereInput = {
    ...(role ? { userType: role } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { fullName: { contains: q, mode: "insensitive" } }, { businessName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const total = await prisma.user.count({ where });
  const { page, pageCount, skip, take } = paginate(total, pageParam(params.page), PAGE);
  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      city: true,
      userType: true,
      status: true,
      businessName: true,
      createdAt: true,
      candidateProfile: { select: { isPublic: true, headline: true } },
      _count: { select: { applications: true, postedJobs: true } },
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1, select: { plan: true, status: true, currentPeriodEnd: true } },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">← Admin console</Link>
      <PageHeader eyebrow="Operations" title="Accounts" description={`${total.toLocaleString()} matching accounts. Suspended users are signed out immediately and cannot log in.`} />
      <form className="mb-6 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Name, email or company" aria-label="Search accounts" className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm sm:max-w-xs" />
        <select name="role" defaultValue={role} aria-label="Role" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">All roles</option>
          {ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select name="status" defaultValue={status} aria-label="Status" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button type="submit" className="min-h-11 rounded-full bg-[#176b52] px-5 text-sm font-semibold text-white">Filter</button>
      </form>
      {users.length === 0 ? (
        <EmptyState title="No accounts found" description="Try a different search or filter." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[24px] border border-[#e7eae5] bg-white">
          {users.map((user) => {
            const latest = user.subscriptions[0];
            const membership = latest ? membershipStatusMeta[latest.status === "ACTIVE" && latest.currentPeriodEnd && latest.currentPeriodEnd <= new Date() ? "EXPIRED" : latest.status] : null;
            const canManage = user.userType !== "ADMIN" && user.id !== admin.id;
            const suspended = user.status === "SUSPENDED";
            return (
              <li key={user.id} className="grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <details className="min-w-0">
                  <summary className="cursor-pointer list-none">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                      {user.fullName}
                      <Badge tone="slate">{user.userType.toLowerCase()}</Badge>
                      {user.status !== "ACTIVE" ? <Badge tone="red">{user.status.toLowerCase()}</Badge> : null}
                      {latest && membership ? <Badge tone={membership.tone}>{planLabels[latest.plan]}: {membership.label}</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">{user.email} · joined {formatDate(user.createdAt)} · <span className="text-emerald-700">details</span></p>
                  </summary>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-[#f8faf7] p-3 text-xs text-slate-600 sm:grid-cols-2">
                    <div><dt className="inline font-semibold">City: </dt><dd className="inline">{user.city ?? "—"}</dd></div>
                    <div><dt className="inline font-semibold">Phone: </dt><dd className="inline">{user.phone ?? "—"}</dd></div>
                    {user.businessName ? <div><dt className="inline font-semibold">Company: </dt><dd className="inline">{user.businessName}</dd></div> : null}
                    {user.userType === "CANDIDATE" ? (
                      <>
                        <div><dt className="inline font-semibold">Applications: </dt><dd className="inline">{user._count.applications}</dd></div>
                        <div><dt className="inline font-semibold">Profile: </dt><dd className="inline">{user.candidateProfile?.isPublic ? "Public" : "Private"}{user.candidateProfile?.headline ? ` · ${user.candidateProfile.headline}` : ""}</dd></div>
                      </>
                    ) : null}
                    {user.userType === "EMPLOYER" ? <div><dt className="inline font-semibold">Jobs posted: </dt><dd className="inline">{user._count.postedJobs}</dd></div> : null}
                    {latest?.currentPeriodEnd ? <div><dt className="inline font-semibold">Membership ends: </dt><dd className="inline">{formatDate(latest.currentPeriodEnd)}</dd></div> : null}
                  </dl>
                </details>
                {canManage ? (
                  <ActionForm action={setUserStatus}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="status" value={suspended ? "ACTIVE" : "SUSPENDED"} />
                    <ConfirmSubmitButton
                      title={suspended ? "Reactivate this account?" : "Suspend this account?"}
                      message={suspended ? `${user.fullName} will be able to sign in again.` : `${user.fullName} will be signed out and unable to sign in until reactivated. Their data is kept.`}
                      confirmLabel={suspended ? "Reactivate account" : "Suspend account"}
                      variant={suspended ? "primary" : "danger"}
                    >
                      {suspended ? "Reactivate" : "Suspend"}
                    </ConfirmSubmitButton>
                  </ActionForm>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath="/admin/accounts" page={page} pageCount={pageCount} params={{ q, role, status }} />
    </main>
  );
}
