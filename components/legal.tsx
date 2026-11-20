import Link from "next/link";
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/constants";

/** Shared layout for the Terms, Privacy and similar policy pages. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Legal</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {LEGAL_LAST_UPDATED}</p>
      <p className="mt-6 text-base leading-7 text-slate-700">{intro}</p>
      <div className="mt-10 space-y-10">{children}</div>
      <nav aria-label="Legal pages" className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-sm font-semibold text-emerald-800">
        <Link href="/terms" className="hover:underline">Terms of Service</Link>
        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        <Link href="/" className="hover:underline">Home</Link>
      </nav>
    </main>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}

/** Contact line that adapts to whether a support address has been configured. */
export function ContactLine({ purpose }: { purpose: string }) {
  return SUPPORT_EMAIL ? (
    <p>
      {purpose}, email us at{" "}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-emerald-800 hover:underline">{SUPPORT_EMAIL}</a>.
    </p>
  ) : (
    <p>{purpose}, contact our support team using the contact details published on this website.</p>
  );
}
