import Link from "next/link";
import { APP_NAME, CITIES } from "@/lib/constants";
import { SiteNavigation } from "@/components/site-navigation";
import type { CurrentUser } from "@/lib/auth";
import { navigationFor } from "@/lib/navigation";

export async function SiteHeader({ user }: { user: CurrentUser | null }) {
  const links = navigationFor(user?.userType ?? null);
  const firstName = user?.fullName.split(" ")[0] ?? "";

  return (
    <header className="sticky top-0 z-30 border-b border-[#e6e9e3] bg-[#fbfcf9]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-3.5 sm:px-6 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-4">
        <Link href={user ? "/dashboard" : "/"} className="group flex items-center gap-3" aria-label={user ? `${APP_NAME} workspace` : `${APP_NAME} home`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#176b52] text-lg font-black tracking-tight text-white shadow-sm shadow-emerald-950/15">C</span>
          <span className="text-[15px] font-bold tracking-tight text-slate-950 group-hover:text-emerald-800">{APP_NAME}</span>
        </Link>
        <SiteNavigation
          links={links}
          authenticated={Boolean(user)}
          firstName={firstName}
        />
      </div>
    </header>
  );
}

const footerColumns = [
  {
    title: "For candidates",
    links: [
      { href: "/jobs", label: "Browse all jobs" },
      { href: "/signup?role=CANDIDATE", label: "Create a career profile" },
      { href: "/pricing", label: "Candidate Pro" },
      { href: "/login", label: "Candidate log in" },
    ],
  },
  {
    title: "For employers",
    links: [
      { href: "/signup?role=EMPLOYER", label: "Post a job" },
      { href: "/pricing", label: "Employer Growth" },
      { href: "/signup?role=EMPLOYER", label: "Create an employer account" },
      { href: "/login", label: "Employer log in" },
    ],
  },
  {
    title: "Jobs by city",
    links: CITIES.filter((city) => city !== "Remote").slice(0, 5).map((city) => ({ href: `/jobs?city=${encodeURIComponent(city)}`, label: `Jobs in ${city}` })).concat({ href: "/jobs?city=Remote", label: "Remote jobs" }),
  },
  {
    title: "Popular fields",
    links: ["Information Technology", "Finance", "Sales", "Marketing", "Engineering", "Customer Service"].map((category) => ({
      href: `/jobs?category=${encodeURIComponent(category)}`,
      label: category,
    })),
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-[#10241d] text-slate-300">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="relative -top-10 flex flex-col items-start justify-between gap-6 rounded-[28px] bg-[#176b52] px-6 py-8 text-white shadow-xl shadow-emerald-950/20 sm:px-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready for your next step?</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/90">Join free as a candidate to apply for jobs, or as an employer to start hiring across Pakistan.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup?role=CANDIDATE" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-[#10543f] hover:bg-emerald-50">Find a job</Link>
            <Link href="/signup?role=EMPLOYER" className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10">Start hiring</Link>
          </div>
        </div>

        <div className="grid gap-10 pb-12 pt-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#176b52] text-base font-black text-white">C</span>
              {APP_NAME}
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Connecting job seekers with employers across Pakistan, from first application to final hire.</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2"><span aria-hidden="true" className="text-emerald-400">✓</span> Free to join for candidates and employers</li>
              <li className="flex items-center gap-2"><span aria-hidden="true" className="text-emerald-400">✓</span> You control who sees your profile</li>
              <li className="flex items-center gap-2"><span aria-hidden="true" className="text-emerald-400">✓</span> Contact details are never made public</li>
            </ul>
          </div>
          {footerColumns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white">{column.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-slate-400 transition hover:text-white">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <p>Built for Pakistan&apos;s job market · Prices in PKR · Times in Pakistan Standard Time</p>
        </div>
      </div>
    </footer>
  );
}
