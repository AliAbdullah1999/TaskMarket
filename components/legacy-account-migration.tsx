import { transitionLegacyAccount } from "@/app/actions/profiles";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";

export function LegacyAccountMigration({ user }: { user: CurrentUser }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow="Account update"
        title={`Welcome back, ${user.fullName.split(" ")[0]}`}
        description="CareerMarket has moved from local services to jobs and recruitment. Choose how you want to use your existing account to open your dashboard."
      />
      <Card className="mb-6 border-sky-200 bg-sky-50">
        <h2 className="font-semibold text-sky-950">Your account and previous records are preserved</h2>
        <p className="mt-1 text-sm leading-6 text-sky-900">
          This updates your account role and creates a new career or company profile. It does not delete your previous marketplace records. Candidate profiles start private; you control whether employers can find you.
        </p>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col">
          <span className="text-sm font-semibold uppercase tracking-wide text-emerald-700">For job seekers</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">I’m looking for a job</h2>
          <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
            Create a candidate profile, browse vacancies, apply for jobs, and track employer responses. Your profile will be private until you choose to share it.
          </p>
          <ActionForm action={transitionLegacyAccount} className="mt-6">
            <input type="hidden" name="role" value="CANDIDATE" />
            <SubmitButton>Continue as candidate</SubmitButton>
          </ActionForm>
        </Card>
        <Card className="flex flex-col">
          <span className="text-sm font-semibold uppercase tracking-wide text-blue-700">For hiring teams</span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">I want to hire</h2>
          <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
            Set up your organization, publish job vacancies, and review applications from a hiring dashboard.
          </p>
          <ActionForm action={transitionLegacyAccount} className="mt-6">
            <input type="hidden" name="role" value="EMPLOYER" />
            <SubmitButton variant="dark">Continue as employer</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </main>
  );
}
