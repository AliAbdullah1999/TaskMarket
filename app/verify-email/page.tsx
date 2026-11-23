import type { Metadata } from "next";
import Link from "next/link";
import { Notice, buttonClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { verifyEmailWithToken } from "@/lib/services/recovery";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false }, referrer: "no-referrer" };

/** Landing page for the link in the confirmation email. Opening the link confirms the address. */
export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const { token } = await props.searchParams;
  const verified = await verifyEmailWithToken(typeof token === "string" ? token : "");
  const user = await getCurrentUser();

  return (
    <main className="mx-auto max-w-md px-5 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Your account</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{verified ? "Email confirmed" : "Link not valid"}</h1>
      {verified ? (
        <>
          <Notice tone="success" className="mt-6">Thank you. Your email address is confirmed and your account is fully active.</Notice>
          <Link href={user ? "/dashboard" : "/login"} className={`${buttonClass.primary} mt-6`}>{user ? "Go to your dashboard" : "Log in"}</Link>
        </>
      ) : (
        <>
          <Notice tone="warning" className="mt-6">
            This confirmation link is invalid or has expired. Log in and use &quot;Resend email&quot; at the top of the page to get a new one.
          </Notice>
          <Link href={user ? "/dashboard" : "/login"} className={`${buttonClass.primary} mt-6`}>{user ? "Go to your dashboard" : "Log in"}</Link>
        </>
      )}
    </main>
  );
}
