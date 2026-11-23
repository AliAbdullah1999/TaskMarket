import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";
const hours = (n: number) => new Date(Date.now() + n * 60 * 60 * 1000);
const days = (n: number) => hours(n * 24);

async function main() {
  // Demo accounts share a published password, so they must never reach a live database.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed demo accounts in production. See docs/CONNECT_HR_DEPLOYMENT.md to create the first administrator.");
  }
  const reset = process.argv.includes("--reset");
  const existing = await prisma.user.count();
  if (existing > 0 && !reset) {
    console.log(`Database already has ${existing} users. Re-run with "npm run prisma:seed -- --reset" to wipe and reseed.`);
    return;
  }
  if (reset) {
    console.log("Resetting all application data…");
    await prisma.$transaction([
      prisma.adminAuditLog.deleteMany(),
      prisma.authToken.deleteMany(),
      prisma.jobInvitation.deleteMany(),
      prisma.rateLimit.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.jobApplication.deleteMany(),
      prisma.job.deleteMany(),
      prisma.candidateProfile.deleteMany(),
      prisma.employerProfile.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.user.create({
    data: { fullName: "Platform Admin", email: "admin@careermarket.pk", passwordHash, userType: "ADMIN", city: "Karachi" },
  });

  const candidate = await prisma.user.create({
    data: {
      fullName: "Amina Siddiqui",
      email: "amina@example.com",
      passwordHash,
      userType: "CANDIDATE",
      city: "Karachi",
      candidateProfile: {
        create: {
          headline: "Product designer with 4 years of fintech experience",
          summary: "UX and product designer focused on accessible digital products, research, and design systems.",
          skills: ["Product Design", "Figma", "User Research", "Prototyping"],
          skillsNormalized: ["product design", "figma", "user research", "prototyping"],
          experienceYears: 4,
          isPublic: true,
        },
      },
    },
  });
  const employer = await prisma.user.create({
    data: {
      fullName: "Maham Khan",
      email: "hiring@northstar.example",
      passwordHash,
      userType: "EMPLOYER",
      city: "Karachi",
      businessName: "Northstar Labs",
      employerProfile: {
        create: {
          companyName: "Northstar Labs",
          industry: "Software",
          website: "https://example.com",
          description: "A growing product studio building practical digital services for customers across Pakistan.",
        },
      },
    },
  });
  const secondEmployer = await prisma.user.create({
    data: {
      fullName: "Hamza Qureshi",
      email: "careers@orbital.example",
      passwordHash,
      userType: "EMPLOYER",
      city: "Lahore",
      businessName: "Orbital Commerce",
      employerProfile: {
        create: {
          companyName: "Orbital Commerce",
          industry: "E-commerce",
          description: "A digital commerce company growing its product and customer operations team.",
        },
      },
    },
  });
  const productDesignerJob = await prisma.job.create({
    data: {
      employerId: employer.id,
      title: "Product Designer",
      description: "Join a cross-functional product team to research customer needs, design clear user journeys, and deliver polished interfaces. You will work closely with product managers and engineers from discovery through launch.",
      requirements: "Experience designing web or mobile products, a strong portfolio, and confidence presenting design decisions.",
      category: "Design",
      city: "Karachi",
      employmentType: "FULL_TIME",
      workplaceType: "HYBRID",
      salaryMin: 180000,
      salaryMax: 260000,
      expiresAt: days(30),
    },
  });
  await prisma.job.create({
    data: {
      employerId: secondEmployer.id,
      title: "Frontend Engineer",
      description: "Build accessible and responsive product experiences with a collaborative engineering team. You will ship user-facing features, improve performance, and work with designers to turn product ideas into maintainable software.",
      requirements: "Strong JavaScript and TypeScript fundamentals, experience with React, and an interest in accessible web development.",
      category: "Information Technology",
      city: "Remote",
      employmentType: "FULL_TIME",
      workplaceType: "REMOTE",
      salaryMin: 220000,
      salaryMax: 350000,
      expiresAt: days(30),
    },
  });
  await prisma.jobApplication.create({
    data: {
      jobId: productDesignerJob.id,
      candidateId: candidate.id,
      employerId: employer.id,
      coverLetter: "I have four years of product design experience and would love to help your team make complex workflows easier for customers.",
      status: "REVIEWING",
    },
  });

  // Demo accounts skip the email confirmation step.
  await prisma.user.updateMany({ data: { emailVerifiedAt: new Date() } });

  console.log("Seed complete. Demo accounts (password: %s):", DEMO_PASSWORD);
  console.log("  admin@careermarket.pk (admin)");
  console.log("  hiring@northstar.example (employer, sample job listing and applicant)");
  console.log("  careers@orbital.example (employer, sample job listing)");
  console.log("  amina@example.com (candidate, sample application)");
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
