import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-slate-600">It may have been removed, or you may not have access to it.</p>
      <Link href="/" className="mt-6 inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
        Go home
      </Link>
    </main>
  );
}
