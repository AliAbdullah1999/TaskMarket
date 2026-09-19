import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fundEscrow } from "@/app/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar, Card, Stars } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { AUTO_RELEASE_HOURS, PAYMENT_METHODS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = { title: "Pay into escrow" };

export default async function CheckoutPage(props: PageProps<"/tasks/[id]/checkout">) {
  const { id } = await props.params;
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      quotes: {
        where: { status: "ACCEPTED" },
        include: { tasker: { select: { fullName: true, businessName: true, taskerProfile: true } } },
      },
    },
  });
  if (!task || task.customerId !== user.id) notFound();
  if (task.status !== "ASSIGNED") redirect(`/tasks/${task.id}`);

  const quote = task.quotes[0];
  if (!quote) redirect(`/tasks/${task.id}`);
  const taskerName = quote.tasker.businessName ?? quote.tasker.fullName;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/tasks/${task.id}`} className="text-sm font-semibold text-emerald-700">
        ← Back to task
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Pay into escrow</h1>
      <p className="mt-2 text-slate-600">
        Your payment is held by TaskMarket — not the tasker — until you confirm the job is done.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Order summary</p>
          <h2 className="mt-2 font-bold text-slate-900">{task.title}</h2>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <Avatar name={taskerName} size="sm" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{taskerName}</p>
              <Stars value={quote.tasker.taskerProfile?.rating ?? 0} count={quote.tasker.taskerProfile?.ratingCount} />
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-700">{quote.scopeSummary}</p>
          <dl className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Quoted price</dt>
              <dd className="font-semibold">{formatPKR(quote.amountPKR)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Service fee</dt>
              <dd className="font-semibold">PKR 0</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base">
              <dt className="font-bold">Total</dt>
              <dd className="font-black">{formatPKR(quote.amountPKR)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <ActionForm action={fundEscrow} className="space-y-5">
            <input type="hidden" name="taskId" value={task.id} />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Payment method</legend>
              <div className="grid gap-2">
                {PAYMENT_METHODS.map((method, index) => (
                  <label
                    key={method.value}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
                  >
                    <input type="radio" name="paymentMethod" value={method.value} defaultChecked={index === 0} className="accent-emerald-600" />
                    <span className="text-sm font-medium text-slate-800">{method.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <ul className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
              <li>✓ Tasker gets the address and chat only after payment.</li>
              <li>✓ Release when you confirm, or automatically {AUTO_RELEASE_HOURS}h after they mark it done.</li>
              <li>✓ Raise a dispute any time before release to freeze funds.</li>
            </ul>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name="agree" required className="mt-1 accent-emerald-600" />
              <span>I agree to the escrow and dispute terms.</span>
            </label>

            <SubmitButton className="w-full" pendingLabel="Processing payment…">
              Pay {formatPKR(quote.amountPKR)}
            </SubmitButton>
            <p className="text-center text-xs text-slate-500">Demo mode: payments are simulated — no money is charged.</p>
          </ActionForm>
        </Card>
      </div>
    </main>
  );
}
