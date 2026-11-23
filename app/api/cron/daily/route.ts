import { createHash, timingSafeEqual } from "node:crypto";
import { runDailyMaintenance } from "@/lib/services/maintenance";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Daily housekeeping: marks lapsed memberships, clears expired counters and links,
 * and emails renewal reminders. Point a scheduler at this route once a day with
 * `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends that header automatically).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await runDailyMaintenance());
}
