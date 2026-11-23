import type { NextConfig } from "next";

// Sent on every response. The Content Security Policy is set per request in proxy.ts
// because it carries a fresh nonce.
const securityHeaders = [
  // Browsers must not guess content types (blocks MIME-sniffing attacks).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The site may not be embedded in frames (clickjacking). CSP frame-ancestors covers modern browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin, never the full URL, to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these device features, so no script may request them.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // Isolate this site's windows from cross-origin openers.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers ignore this over plain HTTP, so it is safe locally; over HTTPS it forces HTTPS for two years.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Lets a verification build use its own folder (NEXT_DIST_DIR=.next-verify) so it never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  // Addresses from the earlier services marketplace lead to the jobs area.
  async redirects() {
    return [
      { source: "/tasks/:path*", destination: "/jobs", permanent: false },
      { source: "/taskers/:path*", destination: "/jobs", permanent: false },
      { source: "/compliance", destination: "/", permanent: false },
    ];
  },
  async rewrites() {
    return [{ source: "/.well-known/security.txt", destination: "/security.txt" }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
