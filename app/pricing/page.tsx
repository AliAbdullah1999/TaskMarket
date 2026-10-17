import type { Metadata } from "next";
import Link from "next/link";
import { requestSubscription } from "@/app/actions/subscriptions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { PLAN_PRICES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = { title: "Membership plans" };

const plans = {
  CANDIDATE_PRO: {
    audience: "For candidates",
    name: "Candidate Pro",
    price: PLAN_PRICES.CANDIDATE_PRO,
    description: "Apply without the free monthly cap and stand out to hiring teams.",
    features: ["Unlimited job applications", "Eligible for priority placement in employer search", "Profile visibility under your control"],
  },
  EMPLOYER_GROWTH: {
    audience: "For employers",
    name: "Employer Growth",
    price: PLAN_PRICES.EMPLOYER_GROWTH,
    description: "Run more searches and manage growing hiring needs.",
    features: ["Up to 5 active job listings", "Search candidate profiles shared with employers", "Unlimited applications to your vacancies"],
  },
};

export default async function PricingPage() {
  const user = await getCurrentUser();
  const subscription = user ? await prisma.subscription.findFirst({
    where: { userId: user.id, status: { in: ["REQUESTED", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
  }) : null;
  const options = user?.userType === "CANDIDATE"
    ? [plans.CANDIDATE_PRO]
    : user?.userType === "EMPLOYER"
      ? [plans.EMPLOYER_GROWTH]
      : user
        ? []
        : Object.values(plans);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Membership"
        title="Plans for every side of the job market"
        description="Start free and upgrade when you need more reach or higher limits."
      />
      <div className={`grid gap-6 ${options.length > 1 ? "md:grid-cols-2" : "max-w-2xl"}`}>
        {options.map((plan) => (
          <Card key={plan.name} className="flex flex-col">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{plan.audience}</p>
            <h2 className="mt-3 text-2xl font-black text-slate-950">{plan.name}</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
            <p className="mt-5 text-3xl font-black text-slate-900">{formatPKR(plan.price)}<span className="text-sm font-medium text-slate-500"> / month</span></p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
            </ul>
            <div className="mt-auto pt-7">
              {!user ? (
                <Link href={`/signup?role=${plan === plans.CANDIDATE_PRO ? "CANDIDATE" : "EMPLOYER"}`} className="inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
                  Create an account
                </Link>
              ) : subscription?.status === "REQUESTED" ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your plan request is awaiting review.</p>
              ) : subscription?.status === "ACTIVE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date() ? (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Your membership is active until {subscription.currentPeriodEnd.toLocaleDateString("en-PK")}.</p>
              ) : user.userType !== "CANDIDATE" && user.userType !== "EMPLOYER" ? (
                <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">Membership plans are available to candidates and employers.</p>
              ) : (
                <ActionForm action={requestSubscription}>
                  <input type="hidden" name="plan" value={plan === plans.CANDIDATE_PRO ? "CANDIDATE_PRO" : "EMPLOYER_GROWTH"} />
                  <SubmitButton>Request this plan</SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-8 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Billing is not connected yet. These are proposed monthly prices; requesting a plan does not charge you or unlock paid limits. An administrator must confirm payment recorded outside the app before membership is activated.
      </p>
    </main>
  );
}
