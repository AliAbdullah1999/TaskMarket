import { COMMISSION_PCT } from "./constants";

/**
 * Accepts an FBR NTN (7 digits + check digit, e.g. 1234567-8) or a 13-digit
 * CNIC, which FBR uses as the NTN for individuals. Returns the normalised form.
 */
export function normalizeNtn(input: string) {
  const digits = input.replace(/[\s-]/g, "");
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 7)}-${digits.slice(7)}`;
  if (/^\d{13}$/.test(digits)) return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  return null;
}

export function splitCommission(amount: number, pct = COMMISSION_PCT) {
  const commissionAmount = Math.round((amount * pct) / 100);
  return { commissionAmount, netAmount: amount - commissionAmount, commissionPct: pct };
}

const PHONE_PATTERN = /(?:\+|00)?\s?92[\s-]?\d{3}[\s-]?\d{7}|\b0?3\d{2}[\s-]?\d{7}\b|\b\d{4}[\s-]\d{3}[\s-]\d{4}\b/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const OFF_PLATFORM_PATTERN = /\b(whats\s?app|wa\.me|telegram|t\.me)\b/gi;

/**
 * Masks direct contact details so coordination stays on-platform and inside escrow.
 */
export function maskContactDetails(body: string) {
  let flagged = false;
  const masked = body
    .replace(PHONE_PATTERN, () => {
      flagged = true;
      return "[number hidden]";
    })
    .replace(EMAIL_PATTERN, () => {
      flagged = true;
      return "[email hidden]";
    })
    .replace(OFF_PLATFORM_PATTERN, (match) => {
      flagged = true;
      return `${match[0]}***`;
    });
  return { body: masked, flagged };
}

/** FBR ledger bucket: first day of the Pakistan-time calendar month, stored as UTC midnight. */
export function reportMonthFor(date: Date) {
  // PKT is UTC+5 with no daylight saving.
  const pkt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), 1));
}
