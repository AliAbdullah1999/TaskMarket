"use server";

import { revalidatePath } from "next/cache";
import { type ActionState, fail, int, runAction, text } from "@/lib/action-state";
import { getCurrentUser } from "@/lib/auth";
import { maskContactDetails, normalizeNtn } from "@/lib/compliance";
import { CATEGORIES, CITIES } from "@/lib/constants";
import { prisma } from "@/lib/db";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) fail("Please log in to continue.");

    const fullName = text(formData, "fullName");
    const phone = text(formData, "phone").replace(/[\s-]/g, "");
    const city = text(formData, "city");
    const businessName = text(formData, "businessName");

    if (fullName.length < 2) fail("Please enter your full name.");
    if (phone && !/^(\+92|0)3\d{9}$/.test(phone)) fail("Enter a Pakistani mobile number like 03001234567.");
    if (!(CITIES as readonly string[]).includes(city)) fail("Choose your city.");

    const saveUser = () =>
      prisma.user.update({
        where: { id: user.id },
        data: { fullName, phone: phone || null, city, businessName: businessName || null },
      });

    let message = "Profile saved.";
    if (user.userType === "TASKER") {
      const categories = formData.getAll("categories").map(String).filter((c) => (CATEGORIES as readonly string[]).includes(c));
      const serviceAreas = formData.getAll("serviceAreas").map(String).filter((c) => (CITIES as readonly string[]).includes(c));
      const bio = maskContactDetails(text(formData, "bio").slice(0, 1200)).body;
      const priceFrom = int(formData, "priceFrom");
      const ntinInput = text(formData, "ntin");

      if (categories.length === 0) fail("Pick at least one service category.");
      if (serviceAreas.length === 0) fail("Pick at least one city you serve.");
      if (priceFrom !== null && (Number.isNaN(priceFrom) || priceFrom < 0)) fail("Starting price must be a whole number.");

      const current = user.taskerProfile;
      let ntin = current?.ntin ?? null;
      let ntinVerified = current?.ntinVerified ?? false;
      if (ntinInput) {
        const normalized = normalizeNtn(ntinInput);
        if (!normalized) fail("NTN must be 7 digits plus a check digit (1234567-8) or a 13-digit CNIC.");
        if (normalized !== ntin) {
          const taken = await prisma.taskerProfile.findFirst({
            where: { ntin: normalized, userId: { not: user.id } },
          });
          if (taken) fail("This NTN is already registered to another tasker.");
          // Changing the NTN sends the profile back through verification.
          ntin = normalized;
          ntinVerified = false;
        }
      }

      const data = {
        categories,
        serviceAreas,
        bio: bio || null,
        priceFrom,
        ntin,
        ntinVerified,
        status: ntin && !ntinVerified ? ("UNDER_REVIEW" as const) : ("ACTIVE" as const),
      };
      await prisma.$transaction([
        saveUser(),
        prisma.taskerProfile.upsert({
          where: { userId: user.id },
          create: { ...data, userId: user.id },
          update: data,
        }),
      ]);
      if (ntin && !ntinVerified) {
        message = "Profile saved. We'll verify your NTN shortly — you can quote once it's approved.";
      }
    } else {
      await saveUser();
    }

    revalidatePath("/", "layout");
    return message;
  });
}
