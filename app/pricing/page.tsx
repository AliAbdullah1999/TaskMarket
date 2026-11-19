import type { Metadata } from "next";
import Link from "next/link";
import { cancelSubscriptionRequest, requestSubscription } from "@/app/actions/subscriptions";
import { ActionForm, ConfirmSubmitButton, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, Notice, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { MEMBERSHIP_DAYS, PLANS, RENEWAL_WINDOW_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembershipOverview } from "@/lib/entitlements";
import { formatDate, formatPKR, membershipStatusMeta, planLabels } from "@/lib/format";
import { planForRole } from "@/lib/services/memberships";

export const metadata: Metadata = { title: "Membership plans" };

type Plan = (typeof PLANS)[keyof typeof PLANS];

function PlanCard({ plan, children }: { plan: Plan; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">{plan.audience}</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{plan.name}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</p>
      <p className="mt-6 text-3xl font-bold tracking-tight text-slate-950">
        {formatPKR(plan.price)}<span className="text-sm font-medium text-slate-500"> / {MEMBERSHIP_DAYS} days</span>
      </p>
      <ul className="mt-6 space-y-3 text-sm text-slate-700">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex gap-2.5"><span aria-hidden="true" className="font-bold text-emerald-700">✓</span><span>{benefit}</span></li>
        ))}
      </ul>
      <div className="mt-6 rounded-2xl bg-[#f8faf7] p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">{plan.freeName} (no charge)</p>
        {plan.freeBenefits.map((benefit) => <p key={benefit} className="mt-1">{benefit}</p>)}
      </div>
      <div className="mt-auto pt-7">{children}</div>
    </Card>
  );
}

export default async function PricingPage() {
  const user = await getCurrentUser();
  const paymentInstructions = process.env.PAYMENT_INSTRUCTIONS?.trim();
  const plan = user ? planForRole(user.userType) : null;

  if (!user || !plan) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
        <PageHeader eyebrow="Membership" title="Plans for every side of the job market" description="Start free. Upgrade when you need higher limits." />
        {user ? <Notice className="mb-6 max-w-2xl">Membership plans are available to candidate and employer accounts.</Notice> : null}
        <div className="grid gap-6 md:grid-cols-2">
          {Object.values(PLANS).map((item) => (
            <PlanCard key={item.plan} plan={item}>
              {!user ? <Link href={`/signup?role=${item.role}`} className={buttonClass.primary}>Create a free account</Link> : null}
            </PlanCard>
          ))}
        </div>
        <HowItWorks />
      </main>
    );
  }

  const details = PLANS[plan];
  const overview = await getMembershipOverview(prisma, user.id, plan);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageHeader eyebrow="Membership" title={details.name} description="Upgrade when you need higher limits. Payment is made outside the app and confirmed by our team." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PlanCard plan={details}>
          {overview.active ? (
            <Notice tone="success" title="Your membership is active">
              Active until {formatDate(overview.active.currentPeriodEnd)}.
              {overview.upcoming ? ` Your renewal is approved and runs until ${formatDate(overview.upcoming.currentPeriodEnd)}.` : ""}
              {!overview.upcoming && !overview.pending && !overview.canRequest && overview.renewalOpensAt
                ? ` You can request a renewal from ${formatDate(overview.renewalOpensAt)}.`
                : ""}
            </Notice>
          ) : null}
          {overview.pending ? (
            <div className="mt-4 space-y-3">
              <Notice tone="warning" title="Request awaiting review">
                Submitted {formatDate(overview.pending.createdAt)}
                {overview.pending.requestedReference ? ` with payment reference ${overview.pending.requestedReference}` : ""}. Your current plan stays in effect until an administrator confirms your payment.
              </Notice>
              <ActionForm action={cancelSubscriptionRequest}>
                <input type="hidden" name="subscriptionId" value={overview.pending.id} />
                <ConfirmSubmitButton title="Cancel this request?" message="Your plan request will be withdrawn. You can submit a new one at any time." confirmLabel="Cancel request">
                  Cancel request
                </ConfirmSubmitButton>
              </ActionForm>
            </div>
          ) : null}
          {overview.canRequest ? (
            <ActionForm action={requestSubscription} className={`space-y-4 ${overview.active ? "mt-4" : ""}`} resetOnSuccess>
              <input type="hidden" name="plan" value={plan} />
              {paymentInstructions ? (
                <Notice title="How to pay"><p className="whitespace-pre-line">{paymentInstructions}</p></Notice>
              ) : (
                <p className="text-sm leading-6 text-slate-600">After you submit a request, our team will contact you with payment instructions.</p>
              )}
              <Field label="Payment reference (optional)" hint="If you have already paid by bank transfer, JazzCash or Easypaisa, enter the transaction ID.">
                <input name="reference" maxLength={100} placeholder="e.g. TRX-12345678" className={inputClass} />
              </Field>
              <SubmitButton pendingLabel="Submitting…">{overview.active ? "Request renewal" : `Request ${details.name}`}</SubmitButton>
            </ActionForm>
          ) : null}
        </PlanCard>

        <Card>
          <h2 className="text-lg font-bold text-slate-950">Membership history</h2>
          {overview.history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No membership requests yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {overview.history.map((item) => {
                const lapsed = item.status === "ACTIVE" && item.currentPeriodEnd && item.currentPeriodEnd <= new Date();
                const meta = membershipStatusMeta[lapsed ? "EXPIRED" : item.status];
                return (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{planLabels[item.plan]}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Requested {formatDate(item.createdAt)}
                        {item.currentPeriodStart ? ` · ${formatDate(item.currentPeriodStart)} – ${formatDate(item.currentPeriodEnd)}` : ""}
                      </p>
                      {item.status === "REJECTED" && item.reviewNote ? <p className="mt-1 text-xs text-rose-700">Reason: {item.reviewNote}</p> : null}
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <HowItWorks />
    </main>
  );
}

function HowItWorks() {
  return (
    <section className="mt-8 max-w-3xl rounded-[22px] border border-[#e7eae5] bg-white p-5 text-sm leading-6 text-slate-600">
      <h2 className="font-semibold text-slate-900">How membership works</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Request a plan from this page. Nothing is charged in the app.</li>
        <li>Pay through the channel our team provides, and share the transaction reference.</li>
        <li>An administrator confirms the payment and activates your membership for {MEMBERSHIP_DAYS} days.</li>
        <li>Benefits end automatically when the period ends. You can request a renewal in the last {RENEWAL_WINDOW_DAYS} days.</li>
      </ol>
    </section>
  );
}
