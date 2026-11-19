import type { Metadata } from "next";
import Link from "next/link";
import { Pagination, pageParam } from "@/components/pagination";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CITIES, PLANS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { canSearchCandidates } from "@/lib/entitlements";
import { searchCandidates } from "@/lib/services/candidates";

export const metadata: Metadata = { title: "Search candidates" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function CandidatesPage(props: PageProps<"/candidates">) {
  const user = await requireUser(["EMPLOYER"]);
  if (!(await canSearchCandidates(prisma, user.id))) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
        <PageHeader eyebrow="Talent search" title="Find your next great hire" description="Search profiles that candidates have chosen to share with employers." />
        <Card className="border-emerald-100 bg-emerald-50">
          <h2 className="text-xl font-bold text-emerald-950">Included with {PLANS.EMPLOYER_GROWTH.name}</h2>
          <ul className="mt-3 space-y-1 text-sm leading-6 text-emerald-900">
            {PLANS.EMPLOYER_GROWTH.benefits.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}
          </ul>
          <Link href="/pricing" className={`${buttonClass.primary} mt-5`}>View Employer Growth</Link>
        </Card>
      </main>
    );
  }

  const params = await props.searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const skill = one(params.skill).trim().slice(0, 40);
  const city = (CITIES as readonly string[]).includes(one(params.city)) ? one(params.city) : "";
  const minExperienceRaw = Number(one(params.experience));
  const minExperience = Number.isInteger(minExperienceRaw) && minExperienceRaw > 0 ? minExperienceRaw : null;
  const result = await searchCandidates({ q, skill, city, minExperience, page: pageParam(params.page) });
  const filtered = Boolean(q || skill || city || minExperience);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader eyebrow="Talent search" title="Candidate profiles" description={`${result.total.toLocaleString()} ${result.total === 1 ? "profile" : "profiles"}. Only candidates who opted in to employer search are shown.`} />
      <form role="search" className="mb-8 grid gap-3 rounded-[24px] border border-[#e7eae5] bg-white p-4 shadow-[0_8px_28px_rgba(23,35,31,0.045)] sm:p-5 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} maxLength={100} placeholder="Keyword, headline or name" className={inputClass} aria-label="Keyword" />
        <input name="skill" defaultValue={skill} maxLength={40} placeholder="Skill, e.g. Excel" className={inputClass} aria-label="Skill" />
        <select name="city" defaultValue={city} className={inputClass} aria-label="Candidate location">
          <option value="">All locations</option>
          {CITIES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select name="experience" defaultValue={minExperience ? String(minExperience) : ""} className={inputClass} aria-label="Minimum experience">
          <option value="">Any experience</option>
          {[1, 2, 3, 5, 8, 10].map((years) => <option key={years} value={years}>{years}+ years</option>)}
        </select>
        <div className="flex items-center gap-3">
          {filtered ? <Link href="/candidates" className="text-sm font-semibold text-slate-500 hover:text-slate-900">Clear</Link> : null}
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-[#176b52] px-5 py-3 text-sm font-semibold text-white hover:bg-[#10543f]">Search</button>
        </div>
      </form>
      {result.items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {result.items.map((candidate) => (
            <Card key={candidate.id} className="flex flex-col">
              <h2 className="text-lg font-bold text-slate-900">
                <Link href={`/candidates/${candidate.id}`} className="hover:text-emerald-800">{candidate.user.fullName}</Link>
              </h2>
              <p className="mt-1 text-sm text-slate-600">{candidate.headline ?? "Candidate"} · {candidate.user.city ?? "Location not set"}</p>
              {candidate.experienceYears !== null ? <p className="mt-3 text-xs font-medium text-slate-500">{candidate.experienceYears} {candidate.experienceYears === 1 ? "year" : "years"} of experience</p> : null}
              {candidate.summary ? <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-700">{candidate.summary}</p> : null}
              {candidate.skills.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {candidate.skills.slice(0, 8).map((item) => <span key={item} className="rounded-full bg-[#f3f5f1] px-2.5 py-1 text-xs font-medium text-slate-600">{item}</span>)}
                </div>
              ) : null}
              <Link href={`/candidates/${candidate.id}`} className="mt-auto pt-4 text-sm font-semibold text-emerald-800 hover:underline">View profile →</Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No public profiles found" description="Try a broader search or another location. Candidates control whether their profiles appear here." href={filtered ? "/candidates" : undefined} cta={filtered ? "Clear filters" : undefined} />
      )}
      <Pagination basePath="/candidates" page={result.page} pageCount={result.pageCount} params={{ q, skill, city, experience: minExperience ? String(minExperience) : "" }} />
    </main>
  );
}
