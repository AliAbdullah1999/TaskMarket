/** Pakistan Standard Time is UTC+5 all year (no daylight saving). */
export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant the current Pakistan-time calendar month began. */
export function pktMonthStart(date: Date = new Date()) {
  const pkt = new Date(date.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), 1) - PKT_OFFSET_MS);
}

/** The instant the next Pakistan-time calendar month begins. */
export function pktNextMonthStart(date: Date = new Date()) {
  const pkt = new Date(date.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth() + 1, 1) - PKT_OFFSET_MS);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}
