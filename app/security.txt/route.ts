import { SUPPORT_EMAIL } from "@/lib/constants";

/**
 * RFC 9116 security contact file, served at /.well-known/security.txt (see the
 * rewrite in next.config.ts). Tells security researchers where to report issues.
 */
export function GET(request: Request) {
  if (!SUPPORT_EMAIL) return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const body = [`Contact: mailto:${SUPPORT_EMAIL}`, `Expires: ${expires}`, "Preferred-Languages: en, ur", `Canonical: ${origin}/.well-known/security.txt`, `Policy: ${origin}/terms#contact`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
