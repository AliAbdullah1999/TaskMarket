"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a page throws unexpectedly (for example, the database is unreachable).
// Error details are logged; users only see a friendly message and a reference code.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-700">Something went wrong</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">We couldn&apos;t load this page</h1>
      <p className="mt-3 leading-7 text-slate-600">Please try again in a moment. If the problem continues, contact support{error.digest ? ` and mention reference ${error.digest}` : ""}.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={() => retry()} className="inline-flex min-h-11 items-center rounded-full bg-[#176b52] px-5 text-sm font-semibold text-white hover:bg-[#10543f]">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Go home
        </Link>
      </div>
    </main>
  );
}
