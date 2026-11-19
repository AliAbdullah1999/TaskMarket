import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-20 text-center sm:px-6 sm:py-28">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">404 · Page not found</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 leading-7 text-slate-600">It may have been removed, or you may not have access to it.</p>
      <Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[#176b52] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#10543f]">
        Go home
      </Link>
    </main>
  );
}
