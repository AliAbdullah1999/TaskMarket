import { prisma } from "./db";

export function parseMonth(value: string | undefined | null) {
  const now = new Date();
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end, key: start.toISOString().slice(0, 7) };
}

/** Per-seller monthly totals from the FBR ledger, as required for marketplace withholding summaries. */
export async function getMonthlySellerSummary(month: string | undefined | null) {
  const { start, end, key } = parseMonth(month);
  const records = await prisma.fBRReportRecord.findMany({
    where: { reportMonth: { gte: start, lt: end } },
    include: { seller: { select: { fullName: true, email: true, taskerProfile: { select: { ntin: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const bySeller = new Map<
    string,
    { sellerId: string; name: string; email: string; ntin: string | null; transactions: number; gross: number; commission: number; net: number }
  >();
  for (const record of records) {
    const row = bySeller.get(record.sellerId) ?? {
      sellerId: record.sellerId,
      name: record.seller.fullName,
      email: record.seller.email,
      ntin: record.seller.taskerProfile?.ntin ?? null,
      transactions: 0,
      gross: 0,
      commission: 0,
      net: 0,
    };
    row.transactions += 1;
    row.gross += record.grossSales;
    row.commission += record.commissionAmount;
    row.net += record.netPayout;
    bySeller.set(record.sellerId, row);
  }

  const sellers = [...bySeller.values()].sort((a, b) => b.gross - a.gross);
  const totals = sellers.reduce(
    (acc, row) => ({
      transactions: acc.transactions + row.transactions,
      gross: acc.gross + row.gross,
      commission: acc.commission + row.commission,
      net: acc.net + row.net,
    }),
    { transactions: 0, gross: 0, commission: 0, net: 0 },
  );
  return { month: key, start, end, records, sellers, totals };
}
