import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/email";

/** Search engines may index public pages only; signed-in areas are excluded. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/jobs", "/pricing", "/terms", "/privacy"],
      disallow: ["/admin", "/account", "/dashboard", "/applications", "/candidates", "/profile", "/jobs/new", "/jobs/manage", "/api", "/reset-password", "/verify-email"],
    },
    sitemap: appUrl("/sitemap.xml"),
  };
}
