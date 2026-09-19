import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { APP_NAME } from "@/lib/constants";
import { hasDatabaseConfig } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Trusted local services`, template: `%s · ${APP_NAME}` },
  description:
    "Post a task, compare quotes from NTN-verified taskers, and pay safely through escrow. Home care, handyman, tutoring and freelance work across Pakistan.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is per-user (session header) and database-backed, so never prerender.
  await connection();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {hasDatabaseConfig ? (
          <>
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </>
        ) : (
          <SetupNotice />
        )}
      </body>
    </html>
  );
}

function SetupNotice() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-bold">Database not configured</h1>
      <p className="mt-3 text-slate-600">
        Copy <code className="rounded bg-slate-200 px-1">.env.example</code> to <code className="rounded bg-slate-200 px-1">.env</code>, set{" "}
        <code className="rounded bg-slate-200 px-1">DATABASE_URL</code>, then run:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
        npm run prisma:push{"\n"}npm run prisma:seed{"\n"}npm run dev
      </pre>
    </main>
  );
}
