"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, fail, int, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function updateCandidateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user || user.userType !== "CANDIDATE") fail("Candidate access required.");
    const headline = text(formData, "headline");
    const summary = text(formData, "summary");
    const skills = text(formData, "skills").split(",").map((skill) => skill.trim()).filter(Boolean);
    const experienceYears = int(formData, "experienceYears");
    const isPublic = formData.get("isPublic") === "on";
    if (headline.length > 120) fail("Headline must be 120 characters or fewer.");
    if (summary.length > 2000) fail("Summary must be 2,000 characters or fewer.");
    if (skills.some((skill) => skill.length > 40) || skills.length > 20) fail("Add up to 20 skills, each 40 characters or fewer.");
    if (
      Number.isNaN(experienceYears) ||
      (experienceYears !== null && (experienceYears < 0 || experienceYears > 60))
    ) fail("Experience must be between 0 and 60 years.");

    await prisma.candidateProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, headline: headline || null, summary: summary || null, skills, experienceYears, isPublic },
      update: { headline: headline || null, summary: summary || null, skills, experienceYears, isPublic },
    });
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/candidates");
    return "Candidate profile saved.";
  });
}

export async function updateEmployerProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user || user.userType !== "EMPLOYER") fail("Employer access required.");
    const companyName = text(formData, "companyName");
    const industry = text(formData, "industry");
    const website = text(formData, "website");
    const description = text(formData, "description");
    if (companyName.length < 2 || companyName.length > 120) fail("Company name must be between 2 and 120 characters.");
    if (industry.length > 100 || description.length > 2000) fail("Industry or company description is too long.");
    if (website && !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(website)) fail("Enter a valid https:// company website.");

    await prisma.employerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, companyName, industry: industry || null, website: website || null, description: description || null },
      update: { companyName, industry: industry || null, website: website || null, description: description || null },
    });
    await prisma.user.update({ where: { id: user.id }, data: { businessName: companyName } });
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    revalidatePath("/candidates");
    return "Employer profile saved.";
  });
}

export async function transitionLegacyAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await getCurrentUser();
    if (!user || !["CUSTOMER", "BUSINESS", "TASKER"].includes(user.userType)) {
      fail("This account has already been updated.");
    }

    const role = text(formData, "role");
    if (role !== "CANDIDATE" && role !== "EMPLOYER") fail("Choose a candidate or employer account.");

    await prisma.$transaction(async (tx) => {
      if (role === "CANDIDATE") {
        const taskerProfile = await tx.taskerProfile.findUnique({ where: { userId: user.id } });
        await tx.candidateProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            headline: taskerProfile?.categories.length ? taskerProfile.categories.join(", ") : null,
            summary: taskerProfile?.bio ?? null,
            skills: taskerProfile?.categories ?? [],
            isPublic: false,
          },
          update: {},
        });
      } else {
        const companyName = user.businessName?.trim() || user.fullName;
        await tx.employerProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, companyName },
          update: {},
        });
        if (!user.businessName) {
          await tx.user.update({ where: { id: user.id }, data: { businessName: companyName } });
        }
      }

      await tx.user.update({ where: { id: user.id }, data: { userType: role } });
    });

    revalidatePath("/dashboard");
    revalidatePath("/profile");
  });
  if (result?.error) return result;
  redirect("/dashboard");
}
