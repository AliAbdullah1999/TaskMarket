import { TIME_ZONE } from "./constants";

export function formatPKR(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function formatDate(date: Date | null | undefined, withTime = false) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

type Tone = "green" | "amber" | "red" | "blue" | "slate";

export const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export const applicationStatusMeta: Record<string, { label: string; tone: Tone }> = {
  SUBMITTED: { label: "Applied", tone: "slate" },
  REVIEWING: { label: "Under review", tone: "blue" },
  SHORTLISTED: { label: "Shortlisted", tone: "green" },
  HIRED: { label: "Hired", tone: "green" },
  REJECTED: { label: "Not selected", tone: "red" },
  WITHDRAWN: { label: "Withdrawn", tone: "slate" },
};

export const membershipStatusMeta: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Pending review", tone: "amber" },
  ACTIVE: { label: "Active", tone: "green" },
  EXPIRED: { label: "Expired", tone: "slate" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
  REJECTED: { label: "Rejected", tone: "red" },
};

export const planLabels: Record<string, string> = {
  CANDIDATE_PRO: "Candidate Pro",
  EMPLOYER_GROWTH: "Employer Growth",
};

export const employmentLabels: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
};

export const workplaceLabels: Record<string, string> = {
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

/** Display status of a job, taking expiry into account. */
export function jobStatusMeta(job: { status: string; expiresAt: Date | null }, now = new Date()): { label: string; tone: Tone } {
  if (job.status === "OPEN" && job.expiresAt && job.expiresAt <= now) return { label: "Expired", tone: "slate" };
  if (job.status === "OPEN") return { label: "Open", tone: "green" };
  if (job.status === "CLOSED") return { label: "Closed", tone: "slate" };
  return { label: "Removed", tone: "red" };
}

export function formatSalary(min: number | null, max: number | null, suffix = " / month") {
  if (!min && !max) return null;
  if (min && max) return `${formatPKR(min)} – ${max.toLocaleString("en-PK")}${suffix}`;
  return min ? `From ${formatPKR(min)}${suffix}` : `Up to ${formatPKR(max)}${suffix}`;
}
