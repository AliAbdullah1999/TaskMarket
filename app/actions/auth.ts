"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { type ActionState, fail, runAction, text } from "@/lib/action-state";
import { createSession, destroySession } from "@/lib/auth";
import { CITIES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const SIGNUP_ROLES = ["CUSTOMER", "BUSINESS", "TASKER"] as const;

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let destination = "/dashboard";
  const result = await runAction(async () => {
    const fullName = text(formData, "fullName");
    const email = text(formData, "email").toLowerCase();
    const phone = text(formData, "phone");
    const city = text(formData, "city");
    const password = text(formData, "password");
    const userType = text(formData, "userType") as (typeof SIGNUP_ROLES)[number];
    const businessName = text(formData, "businessName");

    if (fullName.length < 2) fail("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Please enter a valid email address.");
    if (!SIGNUP_ROLES.includes(userType)) fail("Choose how you want to use the marketplace.");
    if (!(CITIES as readonly string[]).includes(city)) fail("Choose your city.");
    if (phone && !/^(\+92|0)3\d{9}$/.test(phone.replace(/[\s-]/g, ""))) {
      fail("Enter a Pakistani mobile number like 03001234567.");
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      fail("Password must be at least 8 characters and include a letter and a number.");
    }
    if (userType === "BUSINESS" && !businessName) fail("Enter your business name.");

    try {
      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          phone: phone || null,
          city,
          userType,
          businessName: businessName || null,
          passwordHash: await hashPassword(password),
          taskerProfile: userType === "TASKER" ? { create: { serviceAreas: [city] } } : undefined,
        },
      });
      await createSession(user.id);
      if (userType === "TASKER") destination = "/profile?welcome=1";
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        fail("An account with this email already exists.");
      }
      throw error;
    }
  });
  if (result?.error) return result;
  redirect(destination);
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const email = text(formData, "email").toLowerCase();
    const password = text(formData, "password");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      fail("Incorrect email or password.");
    }
    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      fail("This account has been suspended. Contact support.");
    }
    await createSession(user.id);
  });
  if (result?.error) return result;

  const next = text(formData, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
