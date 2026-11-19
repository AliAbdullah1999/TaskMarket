import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSearchCandidates } from "@/lib/entitlements";
import { formatDate } from "@/lib/format";
import { getSearchableCandidate } from "@/lib/services/candidates";

export const metadata: Metadata = { title: "Candidate profile" };

export default async function CandidateProfilePage(props: PageProps<"/candidates/[id]">) {
  const user = await requireUser(["EMPLOYER"]);
  if (!(await canSearchCandidates(prisma, user.id))) redirect("/candidates");
  const { id } = await props.params;
  // Private profiles and inactive accounts resolve to "not found" rather than revealing that they exist.
  const candidate = await getSearchableCandidate(id);
  if (!candidate) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/candidates" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 hover:text-emerald-950">← Back to search</Link>
      <Card className="mt-4">
        <div className="flex items-center gap-4">
          <Avatar name={candidate.user.fullName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{candidate.user.fullName}</h1>
            <p className="mt-1 text-slate-600">{candidate.headline ?? "Candidate"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {candidate.user.city ?? "Location not set"}
              {candidate.experienceYears !== null ? ` · ${candidate.experienceYears} ${candidate.experienceYears === 1 ? "year" : "years"} of experience` : ""}
            </p>
          </div>
        </div>
        {candidate.summary ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Professional summary</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{candidate.summary}</p>
          </section>
        ) : null}
        {candidate.skills.length ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.skills.map((skill) => <span key={skill} className="rounded-full bg-[#f3f5f1] px-3 py-1.5 text-sm font-medium text-slate-700">{skill}</span>)}
            </div>
          </section>
        ) : null}
        <p className="mt-8 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          Profile updated {formatDate(candidate.updatedAt)}. Contact details are shared only when a candidate applies to one of your jobs.
        </p>
      </Card>
    </main>
  );
}
