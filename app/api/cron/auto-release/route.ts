import { runAutoRelease } from "@/lib/escrow";
import { legacyDisabledResponse, legacyTaskMarketEnabled } from "@/lib/legacy";

// Point a scheduler (Vercel Cron, GitHub Actions, cron + curl) at this route hourly
// with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!legacyTaskMarketEnabled()) return legacyDisabledResponse();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const released = await runAutoRelease();
  return Response.json({ released });
}
