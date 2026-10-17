import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser, isCandidate, isEmployer } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

export async function SiteHeader() {
  const user = await getCurrentUser();

  const links = [
    { href: "/jobs", label: "Find jobs" },
    { href: "/pricing", label: "Plans" },
  ];
  if (isCandidate(user)) links.push({ href: "/dashboard", label: "My applications" });
  if (isEmployer(user)) {
    links.push({ href: "/candidates", label: "Find candidates" });
    links.push({ href: "/dashboard", label: "Applicants" });
  }
  if (user?.userType === "ADMIN") links.push({ href: "/admin", label: "Admin" });

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-black text-white">CM</span>
          <span className="text-base font-black tracking-tight">{APP_NAME}</span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-6 overflow-x-auto text-sm font-medium text-slate-600 md:order-none md:w-auto">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isEmployer(user) ? (
                <Link
                  href="/jobs/new"
                  className="hidden rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 sm:inline-flex"
                >
                  Post a job
                </Link>
              ) : null}
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Dashboard
              </Link>
              <Link href={isCandidate(user) || isEmployer(user) ? "/profile" : "/dashboard"} className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 lg:inline">
                {isCandidate(user) || isEmployer(user) ? user.fullName.split(" ")[0] : "Finish setup"}
              </Link>
              <form action={logout}>
                <button type="submit" className="px-2 py-2 text-sm font-medium text-slate-500 hover:text-slate-900">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                Join now
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500">
        <p>
          © {new Date().getFullYear()} {APP_NAME}. Helping talent and employers connect.
        </p>
        <div className="flex gap-5">
          <Link href="/pricing" className="hover:text-slate-900">Plans</Link>
          <Link href="/signup?role=CANDIDATE" className="hover:text-slate-900">Create candidate profile</Link>
          <Link href="/jobs" className="hover:text-slate-900">Browse jobs</Link>
        </div>
      </div>
    </footer>
  );
}
