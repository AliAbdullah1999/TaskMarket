import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { publicJobWhere } from "@/lib/entitlements";

/** Public pages and every job that is currently open, generated at request time from the database. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const jobs = await prisma.job.findMany({
    where: publicJobWhere(new Date()),
    orderBy: { updatedAt: "desc" },
    take: 5000,
    select: { id: true, updatedAt: true },
  });
  return [
    { url: appUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: appUrl("/jobs"), changeFrequency: "hourly", priority: 0.9 },
    { url: appUrl("/pricing"), changeFrequency: "monthly", priority: 0.5 },
    { url: appUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: appUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    ...jobs.map((job) => ({ url: appUrl(`/jobs/${job.id}`), lastModified: job.updatedAt, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
