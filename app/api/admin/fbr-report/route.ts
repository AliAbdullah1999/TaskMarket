import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMonthlySellerSummary } from "@/lib/fbr-report";

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.userType !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const report = await getMonthlySellerSummary(request.nextUrl.searchParams.get("month"));
  const header = ["Month", "Seller ID", "Seller name", "Email", "NTN", "Transactions", "Gross sales (PKR)", "Commission (PKR)", "Net payout (PKR)"];
  const lines = [
    header,
    ...report.sellers.map((row) => [report.month, row.sellerId, row.name, row.email, row.ntin, row.transactions, row.gross, row.commission, row.net]),
    [report.month, "", "TOTAL", "", "", report.totals.transactions, report.totals.gross, report.totals.commission, report.totals.net],
  ];

  if (report.records.length > 0) {
    await prisma.fBRReportRecord.updateMany({
      where: { id: { in: report.records.map((record) => record.id) }, status: "PENDING" },
      data: { status: "GENERATED" },
    });
  }

  return new Response(lines.map((line) => line.map(csvCell).join(",")).join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fbr-seller-summary-${report.month}.csv"`,
    },
  });
}
