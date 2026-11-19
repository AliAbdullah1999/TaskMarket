"use client";

import type { UserType } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, navigationFor } from "@/lib/navigation";

const iconPaths: Record<string, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  jobs: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  applications: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></>,
  candidates: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6v1" /></>,
  profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-1a7 7 0 0 1 14 0v1" /></>,
  plans: <><path d="M4 5h16v14H4zM8 9h8M8 13h5" /><path d="m17 16 1.5 1.5L21 15" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
};

const roleLabels: Partial<Record<UserType, string>> = { CANDIDATE: "Candidate", EMPLOYER: "Employer", ADMIN: "Administrator" };

export function WorkspaceSidebar({ userType, fullName }: { userType: UserType; fullName: string }) {
  const pathname = usePathname();
  const items = navigationFor(userType);
  const current = activeHref(items, pathname);

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[#e5e4dc] bg-[#fbfaf6] lg:block">
      <div className="sticky top-[73px] flex h-[calc(100vh-73px)] flex-col px-4 py-6">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
        <nav aria-label="Workspace navigation" className="mt-3 space-y-1">
          {items.map((item) => {
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${
                  active ? "bg-[#e8eee6] text-[#244d3b] shadow-sm shadow-[#14231c]/[0.03]" : "text-slate-600 hover:bg-[#f0f1eb] hover:text-slate-950"
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px] shrink-0">
                  {iconPaths[item.icon]}
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-[#e8e7df] bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Signed in as</p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">{fullName}</p>
          <p className="mt-1 text-xs text-slate-500">{roleLabels[userType] ?? "Legacy account"}</p>
        </div>
      </div>
    </aside>
  );
}
