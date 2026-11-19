import type { Metadata } from "next";
import Link from "next/link";
import { createJob } from "@/app/actions/jobs";
import { JobForm } from "@/components/job-form";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { GROWTH_ACTIVE_JOB_LIMIT, JOB_LISTING_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getEmployerJobAllowance } from "@/lib/entitlements";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const user = await requireUser(["EMPLOYER"]);
  const allowance = await getEmployerJobAllowance(prisma, user.id);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader eyebrow="For employers" title="Post a job" description="Write a clear, inclusive listing so candidates understand the role and expectations." />
      {!allowance.canPublish ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Posting limit reached</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">You have {allowance.active} of {allowance.limit} active job listings</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {allowance.isGrowth
              ? "Close an existing listing before creating another one."
              : `Your free plan includes one active listing. Employer Growth supports up to ${GROWTH_ACTIVE_JOB_LIMIT} active jobs.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {!allowance.isGrowth ? <Link href="/pricing" className={buttonClass.primary}>View Employer Growth</Link> : null}
            <Link href="/jobs/manage" className={buttonClass.secondary}>Manage job listings</Link>
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
          <JobForm action={createJob} submitLabel="Publish job" pendingLabel="Publishing…" />
          <aside className="space-y-4 xl:sticky xl:top-24">
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Your organization</p>
              <p className="mt-3 truncate text-sm font-bold text-slate-900">{user.businessName ?? user.fullName}</p>
              <Link href="/profile" className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-emerald-800 hover:underline">Edit company profile →</Link>
            </Card>
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Job listing plan</p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{allowance.active}<span className="text-base font-medium text-slate-400"> / {allowance.limit}</span></p>
              <p className="mt-1 text-xs text-slate-500">Active job slots used</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#1f5d45]" style={{ width: `${Math.min(100, (allowance.active / allowance.limit) * 100)}%` }} />
              </div>
              {!allowance.isGrowth ? <Link href="/pricing" className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-emerald-800 hover:underline">Explore Employer Growth →</Link> : null}
            </Card>
            <p className="px-1 text-xs leading-5 text-slate-500">Listings stay open for {JOB_LISTING_DAYS} days. You can edit or close a listing at any time.</p>
          </aside>
        </div>
      )}
    </main>
  );
}
