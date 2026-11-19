import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/signup-form";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { role } = await props.searchParams;
  const defaultRole = role === "EMPLOYER" ? "EMPLOYER" : "CANDIDATE";

  return (
    <main className="mx-auto max-w-2xl px-5 py-14 sm:px-6 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">A better way to move forward</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Create your account</h1>
      <p className="mt-3 leading-7 text-slate-600">Join Pakistan&apos;s job and recruitment network.</p>

      <SignupForm appName={APP_NAME} defaultRole={defaultRole} />

      <p className="mt-7 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-emerald-700">
          Log in
        </Link>
      </p>
    </main>
  );
}
