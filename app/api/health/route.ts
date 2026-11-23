import { prisma } from "@/lib/db";

/** For uptime monitors and load balancers: 200 when the app can reach its database, 503 otherwise. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] database check failed", error);
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
