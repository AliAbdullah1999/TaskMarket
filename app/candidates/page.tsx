import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CITIES } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Find candidates" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function CandidatesPage(props: PageProps<"/candidates">) {
  const user = await requireUser(["EMPLOYER"]);
  const activePlan = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      plan: "EMPLOYER_GROWTH",
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!activePlan) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <PageHeader eyebrow="Talent search" title="Find your next great hire" description="Search profiles candidates have chosen to share with employers." />
        <Card className="border-emerald-100 bg-emerald-50">
          <h2 className="text-xl font-bold text-emerald-950">Included with Employer Growth</h2>
          <p className="mt-2 leading-7 text-emerald-900">An active Growth membership gives your hiring team access to public candidate profiles, plus up to five active job listings.</p>
          <Link href="/pricing" className="mt-5 inline-flex rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white">View employer plan</Link>
        </Card>
      </main>
    );
  }

  const params = await props.searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const city = one(params.city);
  const where: Prisma.CandidateProfileWhereInput = {
    isPublic: true,
    user: { status: "ACTIVE", ...(city ? { city } : {}) },
    ...(q
      ? {
          OR: [
            { headline: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { user: { fullName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const candidates = await prisma.candidateProfile.findMany({
    where,
    take: 50,
    include: {
      user: {
        select: {
          fullName: true,
          city: true,
          subscriptions: {
            where: { plan: "CANDIDATE_PRO", status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
            select: { id: true },
          },
        },
      },
    },
  });
  candidates.sort((a, b) => b.user.subscriptions.length - a.user.subscriptions.length);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader eyebrow="Talent search" title="Candidate profiles" description="Profiles are shown only when the candidate has opted in to employer search." />
      <form className="mb-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Search names or professional experience" className={inputClass} aria-label="Search candidates" />
        <select name="city" defaultValue={city} className={inputClass} aria-label="Candidate location">
          <option value="">All locations</option>
          {CITIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Search</button>
      </form>
      {candidates.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {candidates.map((candidate) => (
            <Card key={candidate.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{candidate.user.fullName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{candidate.headline ?? "Candidate"} · {candidate.user.city ?? "Location not set"}</p>
                </div>
                {candidate.user.subscriptions.length ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Featured</span> : null}
              </div>
              {candidate.experienceYears !== null ? <p className="mt-3 text-xs font-medium text-slate-500">{candidate.experienceYears} years of experience</p> : null}
              {candidate.summary ? <p className="mt-3 line-clamp-5 whitespace-pre-line text-sm leading-6 text-slate-700">{candidate.summary}</p> : null}
              {candidate.skills.length ? <p className="mt-4 text-xs leading-5 text-slate-500">Skills: {candidate.skills.join(", ")}</p> : null}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No public profiles found" description="Try a broader search or another location. Candidates control whether their profiles appear here." />
      )}
    </main>
  );
}
