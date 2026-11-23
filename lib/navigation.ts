import type { UserType } from "@prisma/client";

export type NavItem = { href: string; label: string; icon: string };

/** One navigation definition shared by the header (mobile/tablet) and the workspace sidebar (desktop). */
const NAVIGATION: Record<"CANDIDATE" | "EMPLOYER" | "ADMIN" | "LEGACY" | "GUEST", NavItem[]> = {
  CANDIDATE: [
    { href: "/dashboard", label: "Overview", icon: "overview" },
    { href: "/jobs", label: "Browse jobs", icon: "jobs" },
    { href: "/applications", label: "My applications", icon: "applications" },
    { href: "/profile", label: "My profile", icon: "profile" },
    { href: "/pricing", label: "Membership", icon: "plans" },
    { href: "/account", label: "Account settings", icon: "settings" },
  ],
  EMPLOYER: [
    { href: "/dashboard", label: "Overview", icon: "overview" },
    { href: "/jobs/manage", label: "Manage jobs", icon: "jobs" },
    { href: "/jobs/new", label: "Post a job", icon: "plus" },
    { href: "/applications", label: "Applications", icon: "applications" },
    { href: "/candidates", label: "Search candidates", icon: "candidates" },
    { href: "/profile", label: "Company profile", icon: "profile" },
    { href: "/pricing", label: "Membership", icon: "plans" },
    { href: "/account", label: "Account settings", icon: "settings" },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/memberships", label: "Memberships", icon: "plans" },
    { href: "/admin/accounts", label: "Accounts", icon: "candidates" },
    { href: "/admin/jobs", label: "Job listings", icon: "jobs" },
    { href: "/account", label: "Account settings", icon: "settings" },
  ],
  LEGACY: [{ href: "/dashboard", label: "Account update", icon: "overview" }],
  GUEST: [
    { href: "/jobs", label: "Find jobs", icon: "jobs" },
    { href: "/pricing", label: "Plans", icon: "plans" },
  ],
};

export function navigationFor(userType: UserType | null) {
  if (!userType) return NAVIGATION.GUEST;
  if (userType === "CANDIDATE" || userType === "EMPLOYER" || userType === "ADMIN") return NAVIGATION[userType];
  return NAVIGATION.LEGACY;
}

/** The most specific nav item matching the current path is the active one. */
export function activeHref(items: NavItem[], pathname: string) {
  let best: string | null = null;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}
