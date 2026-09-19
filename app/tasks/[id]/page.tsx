import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptQuote,
  cancelTask,
  confirmCompletion,
  markTaskerComplete,
  raiseDispute,
  startTask,
  submitQuote,
  withdrawQuote,
} from "@/app/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { MessageThread } from "@/components/message-thread";
import { RatingForm } from "@/components/rating-form";
import { Avatar, Badge, Card, Field, Stars, inputClass } from "@/components/ui";
import { decryptAddress } from "@/lib/address-crypto";
import { getCurrentUser } from "@/lib/auth";
import { AUTO_RELEASE_HOURS, COMMISSION_PCT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { runAutoRelease } from "@/lib/escrow";
import {
  escrowStatusMeta,
  formatBudget,
  formatDate,
  formatPKR,
  formatRelative,
  quoteStatusMeta,
  taskStatusMeta,
} from "@/lib/format";

function loadTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, fullName: true, businessName: true, city: true, createdAt: true } },
      tasker: { select: { id: true, fullName: true, businessName: true, taskerProfile: true } },
      escrowTransaction: { include: { payout: true } },
      quotes: {
        orderBy: [{ status: "asc" }, { amountPKR: "asc" }],
        include: { tasker: { select: { id: true, fullName: true, businessName: true, taskerProfile: true } } },
      },
      ratings: { include: { fromUser: { select: { fullName: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, fullName: true, userType: true } } },
      },
    },
  });
}

function shortName(fullName: string) {
  const [first, ...rest] = fullName.split(" ");
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

export async function generateMetadata(props: PageProps<"/tasks/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const task = await prisma.task.findUnique({ where: { id }, select: { title: true } });
  return { title: task?.title ?? "Task" };
}

export default async function TaskDetailPage(props: PageProps<"/tasks/[id]">) {
  const { id } = await props.params;
  const { paid } = await props.searchParams;
  const user = await getCurrentUser();

  let task = await loadTask(id);
  if (!task) notFound();

  const escrowDue = task.escrowTransaction?.status === "FUNDED" && task.escrowTransaction.autoReleaseAt && task.escrowTransaction.autoReleaseAt <= new Date();
  if (escrowDue) {
    await runAutoRelease();
    task = (await loadTask(id))!;
  }

  const isOwner = user?.id === task.customerId;
  const isAssignedTasker = !!user && user.id === task.taskerId;
  const isAdmin = user?.userType === "ADMIN";
  const isParticipant = isOwner || isAssignedTasker;
  const escrow = task.escrowTransaction;
  const escrowFunded = !!escrow && ["FUNDED", "RELEASED", "DISPUTED"].includes(escrow.status);
  const status = taskStatusMeta[task.status];

  // Non-owners only ever see their own quote; everyone sees the count.
  const visibleQuotes = isOwner || isAdmin ? task.quotes : task.quotes.filter((q) => q.taskerId === user?.id);
  const activeQuoteCount = task.quotes.filter((q) => q.status === "ACTIVE").length;
  const myQuote = user ? task.quotes.find((q) => q.taskerId === user.id) : undefined;
  const address = (isOwner || isAdmin || (isAssignedTasker && escrowFunded)) ? decryptAddress(task.addressEncrypted) : null;
  const myRating = user ? task.ratings.find((r) => r.fromUserId === user.id) : undefined;
  const showChat = !!escrow && (isParticipant || isAdmin);
  const chatOpen = isParticipant && ["ESCROW_ACTIVE", "IN_PROGRESS", "DISPUTED"].includes(task.status);
  const customerLabel = task.customer.businessName ?? shortName(task.customer.fullName);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href={isParticipant ? "/dashboard" : "/tasks"} className="text-sm font-semibold text-emerald-700">
        ← {isParticipant ? "Back to dashboard" : "Back to tasks"}
      </Link>

      {paid ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          Payment received and held in escrow. Your tasker can now see the address and message you.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="green">{task.category}{task.serviceType !== task.category ? ` · ${task.serviceType}` : ""}</Badge>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <h1 className="mt-5 text-3xl font-black text-slate-900">{task.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Posted by {customerLabel} · {formatRelative(task.createdAt)}
            </p>
            <p className="mt-5 whitespace-pre-line leading-7 text-slate-700">{task.description}</p>

            <dl className="mt-8 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
              <Detail label="Location" value={`${task.neighborhood ? `${task.neighborhood}, ` : ""}${task.city}`} />
              <Detail label="Budget" value={formatBudget(task.budgetMin, task.budgetMax)} />
              <Detail label="Preferred date" value={task.preferredDate ? formatDate(task.preferredDate, true) : "Flexible"} />
              <Detail label="Est. duration" value={task.durationHours ? `${task.durationHours} hours` : "—"} />
              <Detail label="Quotes received" value={String(activeQuoteCount)} />
              <Detail
                label="Address"
                value={address ?? (task.addressEncrypted ? "🔒 Revealed to the hired tasker after escrow" : "Not required")}
              />
            </dl>
          </Card>

          {visibleQuotes.length > 0 ? (
            <Card>
              <h2 className="text-lg font-bold text-slate-900">{isOwner || isAdmin ? `Quotes (${visibleQuotes.length})` : "Your quote"}</h2>
              <ul className="mt-4 space-y-4">
                {visibleQuotes.map((quote) => {
                  const name = quote.tasker.businessName ?? quote.tasker.fullName;
                  const profile = quote.tasker.taskerProfile;
                  const meta = quoteStatusMeta[quote.status];
                  return (
                    <li key={quote.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} size="sm" />
                          <div>
                            <Link href={`/taskers/${quote.taskerId}`} className="font-semibold text-slate-900 hover:underline">
                              {name}
                            </Link>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <Stars value={profile?.rating ?? 0} count={profile?.ratingCount} />
                              <span>· {profile?.completedJobs ?? 0} jobs</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-slate-900">{formatPKR(quote.amountPKR)}</p>
                          <p className="text-xs text-slate-500">~{quote.etaHours}h · <Badge tone={meta.tone}>{meta.label}</Badge></p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-medium text-slate-800">{quote.scopeSummary}</p>
                      {quote.quoteText ? <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{quote.quoteText}</p> : null}

                      {isOwner && task.status === "OPEN" && quote.status === "ACTIVE" ? (
                        <ActionForm action={acceptQuote} className="mt-4">
                          <input type="hidden" name="quoteId" value={quote.id} />
                          <SubmitButton pendingLabel="Accepting…">Accept & continue to payment</SubmitButton>
                        </ActionForm>
                      ) : null}
                      {quote.taskerId === user?.id && quote.status === "ACTIVE" ? (
                        <ActionForm action={withdrawQuote} className="mt-4">
                          <input type="hidden" name="quoteId" value={quote.id} />
                          <SubmitButton variant="secondary">Withdraw quote</SubmitButton>
                        </ActionForm>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : isOwner && task.status === "OPEN" ? (
            <Card>
              <h2 className="text-lg font-bold text-slate-900">Waiting for quotes</h2>
              <p className="mt-2 text-sm text-slate-600">Verified taskers in {task.city} have been able to see your task. Quotes will appear here.</p>
            </Card>
          ) : null}

          {showChat ? (
            <MessageThread taskId={task.id} messages={task.messages} viewerId={user!.id} open={chatOpen} />
          ) : null}
        </div>

        <aside className="space-y-6">
          {escrow ? (
            <div className="rounded-3xl bg-slate-900 p-6 text-white">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Escrow</p>
                <Badge tone={escrowStatusMeta[escrow.status].tone}>{escrowStatusMeta[escrow.status].label}</Badge>
              </div>
              <p className="mt-3 text-3xl font-black">{formatPKR(escrow.amount)}</p>
              <dl className="mt-4 space-y-2 text-sm text-slate-300">
                {isAssignedTasker || isAdmin ? (
                  <>
                    <Row label={`Commission (${escrow.commissionPct}%)`} value={`− ${formatPKR(escrow.commissionAmount)}`} />
                    <Row label="Your payout" value={formatPKR(escrow.netAmount)} strong />
                  </>
                ) : null}
                <Row label="Reference" value={escrow.paymentReference ?? "—"} />
                <Row label="Funded" value={formatDate(escrow.escrowedAt, true)} />
                {escrow.autoReleaseAt && escrow.status === "FUNDED" ? (
                  <Row label="Auto-release" value={formatDate(escrow.autoReleaseAt, true)} />
                ) : null}
                {escrow.releasedAt ? <Row label="Released" value={formatDate(escrow.releasedAt, true)} /> : null}
                {escrow.payout && (isAssignedTasker || isAdmin) ? <Row label="Payout" value={escrow.payout.status} /> : null}
              </dl>
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-900 p-6 text-white">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Escrow rule</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                The customer pays the accepted quote into escrow before work starts. Funds release when the customer confirms, or automatically{" "}
                {AUTO_RELEASE_HOURS} hours after the tasker marks the job done. A {COMMISSION_PCT}% platform fee is deducted from the tasker payout.
              </p>
            </div>
          )}

          <TaskActions
            task={task}
            user={user}
            isOwner={isOwner}
            isAssignedTasker={isAssignedTasker}
            myQuote={myQuote}
            hasRated={!!myRating}
          />

          {task.ratings.length > 0 ? (
            <Card>
              <h2 className="text-lg font-bold text-slate-900">Reviews</h2>
              <ul className="mt-3 space-y-3">
                {task.ratings.map((rating) => (
                  <li key={rating.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <p className="font-semibold text-slate-900">
                      {"★".repeat(rating.overall)}
                      <span className="text-slate-300">{"★".repeat(5 - rating.overall)}</span>{" "}
                      <span className="font-normal text-slate-500">by {shortName(rating.fromUser.fullName)}</span>
                    </p>
                    {rating.comment ? <p className="mt-1 text-slate-600">{rating.comment}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

type LoadedTask = NonNullable<Awaited<ReturnType<typeof loadTask>>>;

function TaskActions({
  task,
  user,
  isOwner,
  isAssignedTasker,
  myQuote,
  hasRated,
}: {
  task: LoadedTask;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  isOwner: boolean;
  isAssignedTasker: boolean;
  myQuote: LoadedTask["quotes"][number] | undefined;
  hasRated: boolean;
}) {
  const hidden = <input type="hidden" name="taskId" value={task.id} />;
  const escrow = task.escrowTransaction;

  if (!user) {
    return task.status === "OPEN" ? (
      <Card>
        <h2 className="text-lg font-bold text-slate-900">Want this job?</h2>
        <p className="mt-2 text-sm text-slate-600">Sign up as a tasker and verify your NTN to send quotes.</p>
        <div className="mt-4 flex gap-3">
          <Link href={`/login?next=/tasks/${task.id}`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Log in</Link>
          <Link href="/signup?role=TASKER" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Become a tasker</Link>
        </div>
      </Card>
    ) : null;
  }

  if (isOwner) {
    return (
      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Next step</h2>
        {task.status === "OPEN" ? (
          <p className="text-sm text-slate-600">Review quotes on the left and accept the one that fits. You&apos;ll pay into escrow next.</p>
        ) : null}
        {task.status === "ASSIGNED" ? (
          <>
            <p className="text-sm text-slate-600">
              You accepted a quote from <strong>{task.tasker?.businessName ?? task.tasker?.fullName}</strong>. Fund escrow so they can start.
            </p>
            <Link href={`/tasks/${task.id}/checkout`} className="inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              Pay into escrow
            </Link>
          </>
        ) : null}
        {(task.status === "ESCROW_ACTIVE" || task.status === "IN_PROGRESS") && escrow?.status === "FUNDED" ? (
          <>
            <p className="text-sm text-slate-600">
              {task.taskerCompletedAt
                ? `Your tasker marked the job done ${formatRelative(task.taskerCompletedAt)}. Confirm to release payment, or raise a dispute if something is wrong.`
                : task.status === "IN_PROGRESS"
                  ? "Your tasker is working on this job."
                  : "Escrow is funded. Your tasker will start soon."}
            </p>
            <ActionForm action={confirmCompletion}>
              {hidden}
              <SubmitButton pendingLabel="Releasing…">Confirm done & release payment</SubmitButton>
            </ActionForm>
            <DisputeForm taskId={task.id} />
          </>
        ) : null}
        {task.status === "DISPUTED" ? (
          <p className="text-sm text-slate-600">Our team is reviewing the dispute. Escrow stays frozen until it is resolved — you&apos;ll see the outcome in the chat.</p>
        ) : null}
        {task.status === "COMPLETED" ? (
          hasRated ? <p className="text-sm text-slate-600">Task complete. Thanks for rating your tasker!</p> : <RatingForm taskId={task.id} subject="your tasker" />
        ) : null}
        {task.status === "CANCELLED" ? <p className="text-sm text-slate-600">This task was cancelled.</p> : null}
        {task.status === "OPEN" || task.status === "ASSIGNED" ? (
          <ActionForm action={cancelTask}>
            {hidden}
            <SubmitButton variant="danger">Cancel task</SubmitButton>
          </ActionForm>
        ) : null}
      </Card>
    );
  }

  if (isAssignedTasker) {
    return (
      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Your job</h2>
        {task.status === "ASSIGNED" ? (
          <p className="text-sm text-slate-600">Your quote was accepted. Wait for the customer to fund escrow before starting work.</p>
        ) : null}
        {task.status === "ESCROW_ACTIVE" ? (
          <ActionForm action={startTask}>
            {hidden}
            <p className="mb-3 text-sm text-slate-600">Escrow is funded. The address is unlocked — start when you arrive.</p>
            <SubmitButton>Start job</SubmitButton>
          </ActionForm>
        ) : null}
        {(task.status === "ESCROW_ACTIVE" || task.status === "IN_PROGRESS") && escrow?.status === "FUNDED" ? (
          task.taskerCompletedAt ? (
            <p className="text-sm text-slate-600">
              You marked this job done. Payment releases when the customer confirms, or automatically on{" "}
              {formatDate(escrow.autoReleaseAt, true)}.
            </p>
          ) : (
            <ActionForm action={markTaskerComplete}>
              {hidden}
              <SubmitButton variant="dark">Mark job as done</SubmitButton>
            </ActionForm>
          )
        ) : null}
        {(task.status === "ESCROW_ACTIVE" || task.status === "IN_PROGRESS") && escrow?.status === "FUNDED" ? <DisputeForm taskId={task.id} /> : null}
        {task.status === "DISPUTED" ? <p className="text-sm text-slate-600">This job is under dispute review. Escrow is frozen.</p> : null}
        {task.status === "COMPLETED" ? (
          hasRated ? <p className="text-sm text-slate-600">Job complete. Your payout is queued.</p> : <RatingForm taskId={task.id} subject="the customer" />
        ) : null}
        {task.status === "CANCELLED" ? <p className="text-sm text-slate-600">This job was cancelled.</p> : null}
      </Card>
    );
  }

  if (user.userType === "TASKER" && task.status === "OPEN") {
    const profile = user.taskerProfile;
    if (!profile?.ntin || !profile.ntinVerified) {
      return (
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Verify to quote</h2>
          <p className="mt-2 text-sm text-slate-600">
            {profile?.ntin
              ? "Your NTN is being verified. You can quote as soon as it's approved."
              : "Pakistan's marketplace rules require an NTN before you can quote or receive payments."}
          </p>
          <Link href="/profile" className="mt-4 inline-flex rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            {profile?.ntin ? "View profile" : "Add NTN"}
          </Link>
        </Card>
      );
    }
    const canEdit = !myQuote || myQuote.status === "ACTIVE" || myQuote.status === "WITHDRAWN";
    if (!canEdit) return null;
    return (
      <Card>
        <h2 className="text-lg font-bold text-slate-900">{myQuote?.status === "ACTIVE" ? "Update your quote" : "Send a quote"}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Fixed price including materials you bring. You receive {100 - COMMISSION_PCT}% after release.
        </p>
        <ActionForm action={submitQuote} className="mt-4 space-y-4">
          {hidden}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (PKR)">
              <input name="amountPKR" type="number" required min={500} step={50} defaultValue={myQuote?.amountPKR ?? task.budgetMax ?? undefined} className={inputClass} />
            </Field>
            <Field label="Hours needed">
              <input name="etaHours" type="number" required min={1} defaultValue={myQuote?.etaHours ?? task.durationHours ?? undefined} className={inputClass} />
            </Field>
          </div>
          <Field label="What's included">
            <input name="scopeSummary" required minLength={10} maxLength={200} defaultValue={myQuote?.scopeSummary} className={inputClass} />
          </Field>
          <Field label="Message to customer" hint="Phone numbers and emails are hidden automatically.">
            <textarea name="quoteText" rows={3} maxLength={1000} defaultValue={myQuote?.quoteText} className={inputClass} />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Sending…">
            {myQuote?.status === "ACTIVE" ? "Update quote" : "Send quote"}
          </SubmitButton>
        </ActionForm>
      </Card>
    );
  }

  return null;
}

function DisputeForm({ taskId }: { taskId: string }) {
  return (
    <details className="rounded-2xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-rose-700">Report a problem</summary>
      <ActionForm action={raiseDispute} className="mt-3 space-y-3">
        <input type="hidden" name="taskId" value={taskId} />
        <textarea name="reason" required minLength={15} rows={3} placeholder="What went wrong?" className={inputClass} />
        <SubmitButton variant="danger" pendingLabel="Submitting…">
          Raise dispute & freeze escrow
        </SubmitButton>
      </ActionForm>
    </details>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className={strong ? "font-bold text-white" : "text-slate-100"}>{value}</dd>
    </div>
  );
}
