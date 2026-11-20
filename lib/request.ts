import { headers } from "next/headers";

/**
 * Best-effort client address for rate limiting. Behind a proxy or on Vercel the
 * first entry of X-Forwarded-For is the client; it is only used as a throttling
 * key, never for authorization.
 */
export async function clientIp() {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "unknown";
}
