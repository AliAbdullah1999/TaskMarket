"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, fail, int, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeSkills, saveCandidateProfile, saveEmployerProfile } from "@/lib/services/profiles";

export async function updateCandidateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveCandidateProfile(await getCurrentUser(), {
      headline: text(formData, "headline"),
      summary: text(formData, "summary"),
      skills: text(formData, "skills"),
      experienceYears: int(formData, "experienceYears"),
      isPublic: formData.get("isPublic") === "on",
    });
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/candidates");
    return "Candidate profile saved.";
  });
}

export async function updateEmployerProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveEmployerProfile(await getCurrentUser(), {
      companyName: text(formData, "companyName"),
      industry: text(formData, "industry"),
      website: text(formData, "website"),
      description: text(formData, "description"),
    });
    revalidatePath("/profile");
    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    return "Company profile saved.";
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
            skillsNormalized: normalizeSkills(taskerProfile?.categories ?? []),
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
