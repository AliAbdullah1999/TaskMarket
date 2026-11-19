import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { hasDatabaseConfig } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Jobs and careers in Pakistan`, template: `%s · ${APP_NAME}` },
  description: "Discover jobs, build your career profile, and help your business find great candidates across Pakistan.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page is per-user (session header) and database-backed, so never prerender.
  await connection();
  const user = await getCurrentUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="app-body flex min-h-full flex-col bg-background text-foreground">
        {hasDatabaseConfig ? (
          <>
            <SiteHeader user={user} />
            <div className="flex flex-1">
              {user ? <WorkspaceSidebar userType={user.userType} fullName={user.fullName} /> : null}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1">{children}</div>
                {!user ? <SiteFooter /> : null}
              </div>
            </div>
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
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">Almost ready</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Database not configured</h1>
      <p className="mt-3 leading-7 text-slate-600">
        Copy <code className="rounded bg-slate-200 px-1">.env.example</code> to <code className="rounded bg-slate-200 px-1">.env</code>, set{" "}
        <code className="rounded bg-slate-200 px-1">DATABASE_URL</code>, then run:
      </p>
      <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100 shadow-xl shadow-slate-900/10">
        npm run prisma:push{"\n"}npm run prisma:seed{"\n"}npm run dev
      </pre>
    </main>
  );
}
