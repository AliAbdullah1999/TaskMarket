"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { activeHref, type NavItem } from "@/lib/navigation";

export function SiteNavigation({
  links,
  authenticated,
  firstName,
}: {
  links: NavItem[];
  authenticated: boolean;
  firstName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = activeHref(links, pathname);
  // Signed-in users get the workspace sidebar from lg up; below that the menu button carries navigation.
  const menuBreakpoint = authenticated ? "lg:hidden" : "md:hidden";

  return (
    <>
      {!authenticated ? (
        <nav aria-label="Main navigation" className="hidden items-center justify-center gap-1 text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current === link.href ? "page" : undefined}
              className="whitespace-nowrap rounded-full px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-900 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : <div aria-hidden="true" className="hidden md:block" />}

      <div className="flex items-center justify-end gap-2">
        <div className="hidden items-center gap-2 md:flex">
          {authenticated ? (
            <>
              <span className="px-2 text-sm font-semibold text-slate-700">{firstName}</span>
              <form action={logout}>
                <button type="submit" className="min-h-11 rounded-full px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Log in
              </Link>
              <Link href="/signup" className="rounded-full bg-[#176b52] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-950/10 hover:bg-[#10543f]">
                Join now
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${menuBreakpoint}`}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="mobile-site-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true" className="text-xl leading-none">{open ? "×" : "☰"}</span>
        </button>
      </div>

      {open ? (
        <div id="mobile-site-navigation" className={`absolute inset-x-0 top-full max-h-[calc(100vh-73px)] overflow-y-auto border-b border-[#e6e9e3] bg-[#fbfcf9] p-4 shadow-lg shadow-slate-900/5 ${menuBreakpoint}`}>
          <nav aria-label="Mobile navigation" className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={current === link.href ? "page" : undefined}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 aria-[current=page]:bg-[#e8eee6] aria-[current=page]:text-[#244d3b]"
              >
                {link.label}
              </Link>
            ))}
            {authenticated ? (
              <form action={logout} className="border-t border-slate-200 pt-2">
                <button type="submit" className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  Log out
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700">
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="rounded-full bg-[#176b52] px-4 py-3 text-center text-sm font-semibold text-white">
                  Join now
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </>
  );
}
