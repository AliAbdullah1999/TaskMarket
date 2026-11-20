import { getCurrentUser } from "@/lib/auth";
import { exportAccountData } from "@/lib/services/accounts";

/** Lets a signed-in user download a copy of the data held about them. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Please log in to download your data.", { status: 401 });
  const data = await exportAccountData(user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-account-data.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
