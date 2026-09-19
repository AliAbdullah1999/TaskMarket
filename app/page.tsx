import Link from "next/link";
import { TaskCard } from "@/components/task-card";
import { TaskerCard } from "@/components/tasker-card";
import { getCurrentUser, isCustomer } from "@/lib/auth";
import { CATEGORIES, CATEGORY_DESCRIPTIONS, COMMISSION_PCT } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function Home() {
  const user = await getCurrentUser();
  const [openTasks, verifiedTaskers, completedTasks, recentTasks, topTaskers] = await Promise.all([
    prisma.task.count({ where: { status: "OPEN" } }),
    prisma.taskerProfile.count({ where: { ntinVerified: true, status: "ACTIVE" } }),
    prisma.task.count({ where: { status: "COMPLETED" } }),
    prisma.task.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { _count: { select: { quotes: { where: { status: "ACTIVE" } } } } },
    }),
    prisma.taskerProfile.findMany({
      where: { ntinVerified: true, status: "ACTIVE" },
      orderBy: [{ rating: "desc" }, { completedJobs: "desc" }],
      take: 4,
      include: { user: { select: { id: true, fullName: true, businessName: true, city: true } } },
    }),
  ]);

  const postHref = user ? (isCustomer(user) ? "/tasks/new" : "/tasks") : "/signup";

  return (
    <main>
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Trusted local marketplace
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
              Book vetted help for home, learning, and freelance work.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Post what you need, compare quotes from NTN-verified taskers, and pay into escrow. Your money is only released when the job is done.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href={postHref} className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
                {user && !isCustomer(user) ? "Find work" : "Post a task"}
              </Link>
              <Link
                href={user ? "/taskers" : "/signup?role=TASKER"}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {user ? "Explore taskers" : "Become a tasker"}
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
              {["NTN required before quoting", "Escrow before execution", "Masked contact details", "FBR monthly seller summaries"].map((item) => (
                <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  ✓ {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Live marketplace</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Right now on the platform</h2>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                { label: "Open tasks", value: openTasks.toLocaleString() },
                { label: "Verified taskers", value: verifiedTaskers.toLocaleString() },
                { label: "Jobs completed", value: completedTasks.toLocaleString() },
                { label: "Commission", value: `${COMMISSION_PCT}%` },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600">How it works</p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["1. Post", "Describe the job, budget and city. Your address stays private."],
            ["2. Compare", "Verified taskers send fixed quotes with scope and timing."],
            ["3. Pay into escrow", "Fund the accepted quote. Chat and address unlock for your tasker."],
            ["4. Release", `Confirm when done — or funds auto-release 48h after completion.`],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600">Popular categories</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Find the right service</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/taskers?category=${encodeURIComponent(category)}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:border-emerald-200"
            >
              <h3 className="text-base font-bold text-slate-900">{category}</h3>
              <p className="mt-2 text-sm text-slate-600">{CATEGORY_DESCRIPTIONS[category]}</p>
            </Link>
          ))}
        </div>
      </section>

      {topTaskers.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600">Top taskers</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Vetted professionals</h2>
            </div>
            <Link href="/taskers" className="text-sm font-semibold text-emerald-700">View all →</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {topTaskers.map((profile) => (
              <TaskerCard key={profile.id} profile={profile} />
            ))}
          </div>
        </section>
      ) : null}

      {recentTasks.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600">Latest tasks</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Open for quotes</h2>
            </div>
            <Link href="/tasks" className="text-sm font-semibold text-emerald-700">Browse all →</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {recentTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-6 rounded-[32px] bg-slate-900 p-8 text-white md:grid-cols-3">
          <div>
            <p className="text-sm uppercase tracking-[0.14em] text-emerald-300">Trust first</p>
            <h3 className="mt-2 text-2xl font-bold">Payments protected by escrow</h3>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.14em] text-emerald-300">FBR-ready</p>
            <h3 className="mt-2 text-2xl font-bold">NTN checks before quoting</h3>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.14em] text-emerald-300">Masked comms</p>
            <h3 className="mt-2 text-2xl font-bold">Safe coordination after escrow</h3>
          </div>
        </div>
      </section>
    </main>
  );
}
