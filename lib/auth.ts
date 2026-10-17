import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserType } from "@prisma/client";
import { prisma } from "./db";
import { secretKey } from "./secrets";

const SESSION_COOKIE = "tm_session";
const SESSION_DAYS = 14;

type SessionPayload = { uid: string; exp: number };

function sign(data: string) {
  return createHmac("sha256", secretKey("SESSION_SECRET")).update(data).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession({ uid: userId, exp: expires.getTime() }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** The signed-in user (deduplicated per request), or null. */
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      city: true,
      userType: true,
      businessName: true,
      status: true,
      taskerProfile: true,
    },
  });
  if (!user || user.status === "SUSPENDED" || user.status === "BANNED") return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: redirects to login (or the dashboard when the role does not match). */
export async function requireUser(roles?: UserType[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.userType)) redirect("/dashboard");
  return user;
}

export function isCustomer(user: { userType: UserType } | null) {
  return user?.userType === "CUSTOMER" || user?.userType === "BUSINESS";
}

export function isCandidate(user: { userType: UserType } | null) {
  return user?.userType === "CANDIDATE";
}

export function isEmployer(user: { userType: UserType } | null) {
  return user?.userType === "EMPLOYER";
}
