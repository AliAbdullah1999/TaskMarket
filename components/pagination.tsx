import Link from "next/link";

/** Page links that preserve the current filters. Renders nothing for a single page. */
export function Pagination({
  basePath,
  page,
  pageCount,
  params,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const linkClass = "inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-3">
      {page > 1 ? <Link href={href(page - 1)} className={linkClass}>← Previous</Link> : null}
      <span className="px-2 text-sm text-slate-600" aria-current="page">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? <Link href={href(page + 1)} className={linkClass}>Next →</Link> : null}
    </nav>
  );
}

export function pageParam(value: string | string[] | undefined) {
  const page = Number(typeof value === "string" ? value : "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function paginate(total: number, requested: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, pageCount);
  return { page, pageCount, skip: (page - 1) * pageSize, take: pageSize };
}
