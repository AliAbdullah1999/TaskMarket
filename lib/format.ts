import type { EscrowStatus, PayoutStatus, QuoteStatus, TaskStatus } from "@prisma/client";
import { TIME_ZONE } from "./constants";

export function formatPKR(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function formatBudget(min: number | null, max: number | null) {
  if (min && max && min !== max) return `${formatPKR(min)} – ${max.toLocaleString("en-PK")}`;
  return formatPKR(max ?? min);
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

export function formatRelative(date: Date) {
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60 * 60 * 1000) return rtf.format(Math.round(diffMs / 60000), "minute");
  if (abs < 24 * 60 * 60 * 1000) return rtf.format(Math.round(diffMs / 3600000), "hour");
  return rtf.format(Math.round(diffMs / 86400000), "day");
}

export function monthKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" })
    .format(date)
    .slice(0, 7);
}

type Tone = "green" | "amber" | "red" | "blue" | "slate";

export const taskStatusMeta: Record<TaskStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Open for quotes", tone: "green" },
  MATCHED: { label: "Matched", tone: "blue" },
  ASSIGNED: { label: "Awaiting escrow", tone: "amber" },
  ESCROW_ACTIVE: { label: "Escrow funded", tone: "blue" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "slate" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
  DISPUTED: { label: "Disputed", tone: "red" },
  EXPIRED: { label: "Expired", tone: "slate" },
};

export const quoteStatusMeta: Record<QuoteStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Pending", tone: "amber" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  REJECTED: { label: "Not selected", tone: "slate" },
  EXPIRED: { label: "Expired", tone: "slate" },
  WITHDRAWN: { label: "Withdrawn", tone: "slate" },
};

export const escrowStatusMeta: Record<EscrowStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "amber" },
  FUNDED: { label: "Held in escrow", tone: "blue" },
  RELEASED: { label: "Released", tone: "green" },
  REFUNDED: { label: "Refunded", tone: "slate" },
  DISPUTED: { label: "Frozen (dispute)", tone: "red" },
  FAILED: { label: "Failed", tone: "red" },
};

export const payoutStatusMeta: Record<PayoutStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "amber" },
  PROCESSING: { label: "Processing", tone: "blue" },
  PAID: { label: "Paid", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
};

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
