import { PrismaClient } from "@prisma/client";
import { encryptAddress } from "../lib/address-crypto";
import { reportMonthFor, splitCommission } from "../lib/compliance";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";
const hours = (n: number) => new Date(Date.now() + n * 60 * 60 * 1000);
const days = (n: number) => hours(n * 24);

async function main() {
  const reset = process.argv.includes("--reset");
  const existing = await prisma.user.count();
  if (existing > 0 && !reset) {
    console.log(`Database already has ${existing} users. Re-run with "npm run prisma:seed -- --reset" to wipe and reseed.`);
    return;
  }
  if (reset) {
    console.log("Resetting all marketplace data…");
    await prisma.$transaction([
      prisma.fBRReportRecord.deleteMany(),
      prisma.payout.deleteMany(),
      prisma.rating.deleteMany(),
      prisma.message.deleteMany(),
      prisma.escrowTransaction.deleteMany(),
      prisma.quote.deleteMany(),
      prisma.task.deleteMany(),
      prisma.taskerProfile.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.user.create({
    data: { fullName: "Platform Admin", email: "admin@taskmarket.pk", passwordHash, userType: "ADMIN", city: "Karachi" },
  });

  const ayesha = await prisma.user.create({
    data: { fullName: "Ayesha Malik", email: "ayesha@example.com", phone: "03001234567", city: "Karachi", userType: "CUSTOMER", passwordHash },
  });
  const usman = await prisma.user.create({
    data: { fullName: "Usman Khan", email: "usman@example.com", phone: "03211234567", city: "Karachi", userType: "CUSTOMER", passwordHash },
  });
  const zafar = await prisma.user.create({
    data: {
      fullName: "Zafar Rehman",
      email: "zafar@example.com",
      city: "Islamabad",
      userType: "BUSINESS",
      businessName: "Rehman Organics",
      passwordHash,
    },
  });

  const tasker = (
    fullName: string,
    email: string,
    city: string,
    profile: { ntin: string | null; ntinVerified: boolean; categories: string[]; serviceAreas: string[]; bio: string; priceFrom: number; businessName?: string },
  ) =>
    prisma.user.create({
      data: {
        fullName,
        email,
        city,
        userType: "TASKER",
        businessName: profile.businessName,
        passwordHash,
        taskerProfile: {
          create: {
            ntin: profile.ntin,
            ntinVerified: profile.ntinVerified,
            verificationTier: profile.ntinVerified ? "TRUSTED" : "BASIC",
            backgroundCheckStatus: profile.ntinVerified ? "APPROVED" : "PENDING",
            status: profile.ntin && !profile.ntinVerified ? "UNDER_REVIEW" : "ACTIVE",
            categories: profile.categories,
            serviceAreas: profile.serviceAreas,
            bio: profile.bio,
            priceFrom: profile.priceFrom,
          },
        },
      },
    });

  const hina = await tasker("Hina Baig", "hina@example.com", "Karachi", {
    businessName: "Hina Service Co.",
    ntin: "4123456-7",
    ntinVerified: true,
    categories: ["Home Care"],
    serviceAreas: ["Karachi"],
    bio: "Team of four trained cleaners. Deep cleaning, move-in/move-out and post-renovation cleanups. We bring all supplies and equipment.",
    priceFrom: 3000,
  });
  const bilal = await tasker("Bilal Ahmed", "bilal@example.com", "Karachi", {
    businessName: "FixIt Pakistan",
    ntin: "3987654-1",
    ntinVerified: true,
    categories: ["Handyman"],
    serviceAreas: ["Karachi", "Lahore"],
    bio: "Licensed plumber and electrician with 12 years of experience. Leak repairs, wiring, geyser installation and UPS setup.",
    priceFrom: 2500,
  });
  await tasker("Areeb Siddiqui", "areeb@example.com", "Lahore", {
    businessName: "Areeb Tutor Lab",
    ntin: "35202-1234567-1",
    ntinVerified: true,
    categories: ["Tutoring"],
    serviceAreas: ["Lahore", "Remote"],
    bio: "O/A-Level Maths and Physics tutor. LUMS graduate, 6 years of teaching, online or in-person in Lahore.",
    priceFrom: 2200,
  });
  const sana = await tasker("Sana Javed", "sana@example.com", "Islamabad", {
    businessName: "Creative Bytes",
    ntin: "7456123-9",
    ntinVerified: true,
    categories: ["Digital Services", "Freelance"],
    serviceAreas: ["Islamabad", "Rawalpindi", "Remote"],
    bio: "Brand designer and Shopify developer. Catalogs, logos, social media kits and store setups for small businesses.",
    priceFrom: 8000,
  });
  await tasker("Kamran Ali", "kamran@example.com", "Lahore", {
    ntin: "5566778-2",
    ntinVerified: false,
    categories: ["Handyman", "Home Care"],
    serviceAreas: ["Lahore"],
    bio: "AC servicing and general repairs across Lahore.",
    priceFrom: 2000,
  });

  // 1) Open task with competing quotes.
  const cleaning = await prisma.task.create({
    data: {
      title: "Deep cleaning for 2-bedroom flat",
      description: "Need a deep clean for kitchen, both bathrooms, bedrooms and living room before Eid guests arrive. Kitchen cabinets need degreasing inside and out.",
      category: "Home Care",
      serviceType: "Deep cleaning",
      city: "Karachi",
      neighborhood: "Gulshan-e-Iqbal",
      budgetMin: 3000,
      budgetMax: 4500,
      durationHours: 5,
      preferredDate: days(3),
      customerId: ayesha.id,
      addressEncrypted: encryptAddress("Flat 12-B, Block 13-D, Gulshan-e-Iqbal, Karachi"),
      requirements: { rooms: 2, includeKitchen: true },
    },
  });
  await prisma.quote.create({
    data: {
      taskId: cleaning.id,
      taskerId: hina.id,
      amountPKR: 4000,
      etaHours: 5,
      scopeSummary: "Two cleaners, all supplies, kitchen degreasing included",
      quoteText: "We can come Thursday morning. Our team has done 400+ flats in Gulshan.",
      expiresAt: days(7),
    },
  });

  // 2) Open tasks without quotes.
  await prisma.task.create({
    data: {
      title: "Urgent maths tutor for O-Level prep",
      description: "Looking for a tutor for algebra and geometry revision, two sessions per week for three weeks before mock exams.",
      category: "Tutoring",
      serviceType: "O-Level Maths",
      city: "Lahore",
      neighborhood: "Model Town",
      budgetMin: 4000,
      budgetMax: 6000,
      durationHours: 12,
      customerId: usman.id,
      addressEncrypted: encryptAddress("House 44, Block C, Model Town, Lahore"),
    },
  });
  await prisma.task.create({
    data: {
      title: "Install ceiling fan and two light fixtures",
      description: "New ceiling fan (already purchased) in the bedroom and two LED fixtures in the lounge. Wiring points already exist.",
      category: "Handyman",
      serviceType: "Electrical",
      city: "Karachi",
      neighborhood: "DHA Phase 6",
      budgetMax: 3500,
      durationHours: 3,
      preferredDate: days(2),
      customerId: usman.id,
      addressEncrypted: encryptAddress("22-C, Khayaban-e-Shamsheer, DHA Phase 6, Karachi"),
    },
  });

  // 3) Escrow funded, job in progress, chat open.
  const sink = await prisma.task.create({
    data: {
      title: "Fix leaking kitchen sink",
      description: "Kitchen sink leaks from the drain pipe underneath. Needs inspection and replacement of the trap if required.",
      category: "Handyman",
      serviceType: "Plumbing",
      city: "Karachi",
      neighborhood: "Clifton",
      budgetMax: 3000,
      durationHours: 2,
      status: "IN_PROGRESS",
      customerId: usman.id,
      taskerId: bilal.id,
      addressEncrypted: encryptAddress("Apartment 7, Sea View Towers, Block 2, Clifton, Karachi"),
    },
  });
  await prisma.quote.create({
    data: { taskId: sink.id, taskerId: bilal.id, amountPKR: 2800, etaHours: 2, scopeSummary: "Inspection, new P-trap and sealant", quoteText: "", status: "ACCEPTED" },
  });
  const sinkSplit = splitCommission(2800);
  await prisma.escrowTransaction.create({
    data: {
      taskId: sink.id,
      customerId: usman.id,
      taskerId: bilal.id,
      amount: 2800,
      ...sinkSplit,
      status: "FUNDED",
      paymentMethod: "jazzcash",
      paymentReference: "TM-DEMO-SINK01",
      escrowedAt: hours(-20),
    },
  });
  await prisma.message.createMany({
    data: [
      { taskId: sink.id, senderId: usman.id, channelType: "SYSTEM", body: "Escrow funded (ref TM-DEMO-SINK01). The address is now visible to the tasker and chat is open.", createdAt: hours(-20) },
      { taskId: sink.id, senderId: bilal.id, body: "Assalam-o-Alaikum! I can come tomorrow at 11am. Is parking available?", createdAt: hours(-19) },
      { taskId: sink.id, senderId: usman.id, body: "Walaikum Salaam, yes, visitor parking in the basement.", createdAt: hours(-18) },
      { taskId: sink.id, senderId: bilal.id, channelType: "SYSTEM", body: "Tasker started the job.", createdAt: hours(-2) },
    ],
  });

  // 4) Completed task with released escrow, payout, FBR record and ratings.
  const catalog = await prisma.task.create({
    data: {
      title: "Design a 10-page product catalog in Canva",
      description: "Product catalog for our organic food store launch. We will share photos and prices; need an editable Canva file and print-ready PDF.",
      category: "Digital Services",
      serviceType: "Graphic design",
      city: "Remote",
      budgetMin: 9000,
      budgetMax: 12000,
      durationHours: 16,
      status: "COMPLETED",
      customerId: zafar.id,
      taskerId: sana.id,
      taskerCompletedAt: days(-4),
      completedAt: days(-3),
    },
  });
  await prisma.quote.create({
    data: { taskId: catalog.id, taskerId: sana.id, amountPKR: 11000, etaHours: 16, scopeSummary: "10 pages, 2 revision rounds, Canva + PDF", quoteText: "", status: "ACCEPTED" },
  });
  const catalogSplit = splitCommission(11000);
  const catalogEscrow = await prisma.escrowTransaction.create({
    data: {
      taskId: catalog.id,
      customerId: zafar.id,
      taskerId: sana.id,
      amount: 11000,
      ...catalogSplit,
      status: "RELEASED",
      paymentMethod: "card",
      paymentReference: "TM-DEMO-CAT001",
      escrowedAt: days(-8),
      releasedAt: days(-3),
    },
  });
  await prisma.payout.create({
    data: {
      escrowTransactionId: catalogEscrow.id,
      taskerId: sana.id,
      grossAmount: 11000,
      commissionAmount: catalogSplit.commissionAmount,
      netAmount: catalogSplit.netAmount,
    },
  });
  await prisma.fBRReportRecord.create({
    data: {
      reportMonth: reportMonthFor(days(-3)),
      sellerId: sana.id,
      taskId: catalog.id,
      transactionId: "TM-DEMO-CAT001",
      escrowTransactionId: catalogEscrow.id,
      grossSales: 11000,
      commissionAmount: catalogSplit.commissionAmount,
      netPayout: catalogSplit.netAmount,
    },
  });
  await prisma.rating.create({
    data: {
      taskId: catalog.id,
      fromUserId: zafar.id,
      toUserId: sana.id,
      overall: 5,
      punctuality: 5,
      professionalism: 5,
      communication: 4,
      comment: "Beautiful catalog, delivered a day early. Will hire again.",
    },
  });
  await prisma.taskerProfile.update({ where: { userId: sana.id }, data: { rating: 5, ratingCount: 1, completedJobs: 1 } });


  console.log("Seed complete. Demo accounts (password: %s):", DEMO_PASSWORD);
  console.log("  admin@taskmarket.pk  (admin)");
  console.log("  ayesha@example.com   (customer, open task with a quote)");
  console.log("  usman@example.com    (customer, job in progress)");
  console.log("  zafar@example.com    (business, completed job)");
  console.log("  hina@example.com, bilal@example.com, areeb@example.com, sana@example.com (verified taskers)");
  console.log("  kamran@example.com   (tasker awaiting NTN verification)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
