import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, Card, Stars } from "@/components/ui";
import { getCurrentUser, isCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatPKR } from "@/lib/format";

function loadTasker(id: string) {
  return prisma.user.findFirst({
    where: { id, userType: "TASKER", status: "ACTIVE" },
    select: {
      id: true,
      fullName: true,
      businessName: true,
      city: true,
      createdAt: true,
      taskerProfile: true,
      ratingsReceived: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          overall: true,
          punctuality: true,
          professionalism: true,
          communication: true,
          comment: true,
          createdAt: true,
          fromUser: { select: { fullName: true } },
          task: { select: { category: true } },
        },
      },
    },
  });
}

export async function generateMetadata(props: PageProps<"/taskers/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const tasker = await prisma.user.findUnique({ where: { id }, select: { fullName: true, businessName: true } });
  return { title: tasker ? (tasker.businessName ?? tasker.fullName) : "Tasker" };
}

export default async function TaskerProfilePage(props: PageProps<"/taskers/[id]">) {
  const { id } = await props.params;
  const [tasker, viewer] = await Promise.all([loadTasker(id), getCurrentUser()]);
  if (!tasker?.taskerProfile) notFound();

  const profile = tasker.taskerProfile;
  const name = tasker.businessName ?? tasker.fullName;
  const reviews = tasker.ratingsReceived;
  const avg = (key: "punctuality" | "professionalism" | "communication") =>
    reviews.length ? reviews.reduce((sum, r) => sum + r[key], 0) / reviews.length : 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/taskers" className="text-sm font-semibold text-emerald-700">
        ← All taskers
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="h-fit">
          <Avatar name={name} size="lg" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">{name}</h1>
          {tasker.businessName ? <p className="text-sm text-slate-500">{tasker.fullName}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.ntinVerified ? <Badge tone="green">NTN verified</Badge> : <Badge tone="amber">Verification pending</Badge>}
            {profile.verificationTier !== "BASIC" ? <Badge tone="blue">{profile.verificationTier === "HIGH_TRUST" ? "High trust" : "Trusted"}</Badge> : null}
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Rating</dt>
              <dd>
                <Stars value={profile.rating} count={profile.ratingCount} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Jobs completed</dt>
              <dd className="font-semibold">{profile.completedJobs}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Starting at</dt>
              <dd className="font-semibold">{formatPKR(profile.priceFrom)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Member since</dt>
              <dd className="font-semibold">{formatDate(tasker.createdAt)}</dd>
            </div>
          </dl>
          {isCustomer(viewer) || !viewer ? (
            <Link
              href={viewer ? "/tasks/new" : "/signup"}
              className="mt-6 block rounded-full bg-emerald-600 px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Post a task to get a quote
            </Link>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-bold text-slate-900">About</h2>
            <p className="mt-3 whitespace-pre-line text-slate-700">{profile.bio || "This tasker hasn't written a bio yet."}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Services</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.categories.map((c) => (
                    <Badge key={c} tone="green">{c}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Cities</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.serviceAreas.map((c) => (
                    <Badge key={c} tone="slate">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-900">Reviews ({profile.ratingCount})</h2>
            {reviews.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                {(["punctuality", "professionalism", "communication"] as const).map((key) => (
                  <div key={key} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xl font-black">{avg(key).toFixed(1)}</p>
                    <p className="text-xs capitalize text-slate-500">{key}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <ul className="mt-4 divide-y divide-slate-100">
              {reviews.length === 0 ? <li className="py-3 text-sm text-slate-500">No reviews yet.</li> : null}
              {reviews.map((review) => (
                <li key={review.id} className="py-4 text-sm">
                  <p className="font-semibold text-amber-500">
                    {"★".repeat(review.overall)}
                    <span className="text-slate-300">{"★".repeat(5 - review.overall)}</span>
                  </p>
                  {review.comment ? <p className="mt-1 text-slate-700">{review.comment}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {review.fromUser.fullName.split(" ")[0]} · {review.task.category} · {formatDate(review.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
