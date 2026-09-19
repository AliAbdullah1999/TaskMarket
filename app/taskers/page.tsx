import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { TaskerCard } from "@/components/tasker-card";
import { EmptyState, PageHeader, inputClass } from "@/components/ui";
import { CATEGORIES, CITIES } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Verified taskers" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function TaskersPage(props: PageProps<"/taskers">) {
  const params = await props.searchParams;
  const category = one(params.category);
  const city = one(params.city);
  const q = one(params.q).slice(0, 100);

  const where: Prisma.TaskerProfileWhereInput = {
    ntinVerified: true,
    status: "ACTIVE",
    user: { status: "ACTIVE", ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { businessName: { contains: q, mode: "insensitive" } }] } : {}) },
    ...((CATEGORIES as readonly string[]).includes(category) ? { categories: { has: category } } : {}),
    ...((CITIES as readonly string[]).includes(city) ? { serviceAreas: { has: city } } : {}),
  };

  const taskers = await prisma.taskerProfile.findMany({
    where,
    orderBy: [{ rating: "desc" }, { completedJobs: "desc" }],
    take: 60,
    include: { user: { select: { id: true, fullName: true, businessName: true, city: true } } },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Verified taskers"
        title="Browse trusted professionals"
        description="Every tasker listed here has a verified NTN and is paid only through escrow."
      />

      <form className="mb-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Search by name…" className={inputClass} aria-label="Search" />
        <select name="category" defaultValue={category} className={inputClass} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="city" defaultValue={city} className={inputClass} aria-label="City">
          <option value="">All cities</option>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
          Filter
        </button>
      </form>

      {taskers.length === 0 ? (
        <EmptyState title="No taskers found" description="Try another category or city." href="/taskers" cta="Clear filters" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {taskers.map((profile) => (
            <TaskerCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </main>
  );
}
