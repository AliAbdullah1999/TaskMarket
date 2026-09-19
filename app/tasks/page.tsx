import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { TaskCard } from "@/components/task-card";
import { EmptyState, PageHeader, inputClass } from "@/components/ui";
import { getCurrentUser, isCustomer } from "@/lib/auth";
import { CATEGORIES, CITIES } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Browse tasks" };

const PAGE_SIZE = 18;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function TasksPage(props: PageProps<"/tasks">) {
  const params = await props.searchParams;
  const q = one(params.q).slice(0, 100);
  const category = one(params.category);
  const city = one(params.city);
  const sort = one(params.sort);
  const page = Math.max(1, Number(one(params.page)) || 1);

  const where: Prisma.TaskWhereInput = {
    status: "OPEN",
    ...((CATEGORIES as readonly string[]).includes(category) ? { category } : {}),
    ...((CITIES as readonly string[]).includes(city) ? { city } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { neighborhood: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.TaskOrderByWithRelationInput =
    sort === "budget" ? { budgetMax: "desc" } : sort === "soonest" ? { preferredDate: { sort: "asc", nulls: "last" } } : { createdAt: "desc" };

  const [user, tasks, total] = await Promise.all([
    getCurrentUser(),
    prisma.task.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { quotes: { where: { status: "ACTIVE" } } } } },
    }),
    prisma.task.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const search = new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...(city && { city }), ...(sort && { sort }), page: String(n) });
    return `/tasks?${search}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Available tasks"
        title="Live marketplace jobs"
        description={`${total} open ${total === 1 ? "task" : "tasks"} accepting quotes.`}
        action={
          isCustomer(user) || !user ? (
            <Link href={user ? "/tasks/new" : "/signup"} className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
              Post a task
            </Link>
          ) : null
        }
      />

      <form className="mb-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Search tasks…" className={inputClass} aria-label="Search" />
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
        <select name="sort" defaultValue={sort} className={inputClass} aria-label="Sort">
          <option value="">Newest</option>
          <option value="budget">Highest budget</option>
          <option value="soonest">Needed soonest</option>
        </select>
        <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
          Filter
        </button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks match" description="Try a different city or category, or clear your search." href="/tasks" cta="Clear filters" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-10 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-full border border-slate-200 bg-white px-4 py-2">← Previous</Link> : null}
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={pageHref(page + 1)} className="rounded-full border border-slate-200 bg-white px-4 py-2">Next →</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
