"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, fail, int, runAction, text } from "@/lib/action-state";
import { encryptAddress } from "@/lib/address-crypto";
import { getCurrentUser, isCustomer } from "@/lib/auth";
import { maskContactDetails, splitCommission } from "@/lib/compliance";
import { AUTO_RELEASE_HOURS, CATEGORIES, CITIES, COMMISSION_PCT, PAYMENT_METHODS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { recalculateTaskerRating, releaseEscrow } from "@/lib/escrow";

async function signedInUser() {
  const user = await getCurrentUser();
  if (!user) fail("Please log in to continue.");
  return user;
}

async function loadTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { escrowTransaction: true },
  });
  if (!task) fail("Task not found.");
  return task;
}

function refreshTask(taskId: string) {
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
}

function parsePktDateTime(value: string) {
  if (!value) return null;
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}+05:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let taskId = "";
  const result = await runAction(async () => {
    const user = await signedInUser();
    if (!isCustomer(user)) fail("Only customer and business accounts can post tasks.");

    const title = text(formData, "title");
    const description = text(formData, "description");
    const category = text(formData, "category");
    const serviceType = text(formData, "serviceType");
    const city = text(formData, "city");
    const neighborhood = text(formData, "neighborhood");
    const address = text(formData, "address");
    const budgetMin = int(formData, "budgetMin");
    const budgetMax = int(formData, "budgetMax");
    const durationHours = int(formData, "durationHours");
    const preferredDate = parsePktDateTime(text(formData, "preferredDate"));

    if (title.length < 8) fail("Give your task a clear title (at least 8 characters).");
    if (description.length < 20) fail("Describe the work in a bit more detail (at least 20 characters).");
    if (!(CATEGORIES as readonly string[]).includes(category)) fail("Choose a category.");
    if (!(CITIES as readonly string[]).includes(city)) fail("Choose a city.");
    if (Number.isNaN(budgetMin) || Number.isNaN(budgetMax) || Number.isNaN(durationHours)) {
      fail("Budget and duration must be whole numbers.");
    }
    if (!budgetMax || budgetMax < 500) fail("Set a maximum budget of at least PKR 500.");
    if (budgetMin && budgetMin > budgetMax) fail("Minimum budget cannot exceed the maximum.");
    if (preferredDate === undefined) fail("Preferred date is invalid.");
    if (preferredDate && preferredDate.getTime() < Date.now() - 60 * 60 * 1000) {
      fail("Preferred date must be in the future.");
    }
    if (city !== "Remote" && category !== "Freelance" && category !== "Digital Services" && address.length < 10) {
      fail("On-site tasks need a full address. It stays hidden until escrow is funded.");
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        category,
        serviceType: serviceType || category,
        city,
        neighborhood: neighborhood || null,
        budgetMin: budgetMin || null,
        budgetMax,
        durationHours: durationHours || null,
        preferredDate,
        customerId: user.id,
        addressEncrypted: address ? encryptAddress(address) : null,
        addressMode: "DISCLOSED_AFTER_ESCROW",
      },
    });
    taskId = task.id;
    revalidatePath("/tasks");
  });
  if (result?.error) return result;
  redirect(`/tasks/${taskId}`);
}

export async function cancelTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.customerId !== user.id) fail("Only the customer can cancel this task.");
    if (task.status !== "OPEN" && task.status !== "ASSIGNED") {
      fail("Funded tasks cannot be cancelled. Raise a dispute instead.");
    }

    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status: "CANCELLED" } }),
      prisma.quote.updateMany({
        where: { taskId: task.id, status: { in: ["ACTIVE", "ACCEPTED"] } },
        data: { status: "REJECTED" },
      }),
    ]);
    refreshTask(task.id);
    return "Task cancelled.";
  });
}

export async function submitQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    if (user.userType !== "TASKER") fail("Only tasker accounts can send quotes.");
    const profile = user.taskerProfile;
    if (!profile?.ntin) fail("Add your NTN to your profile before quoting.");
    if (!profile.ntinVerified) fail("Your NTN is still being verified. You can quote once it is approved.");
    if (profile.status !== "ACTIVE") fail("Your tasker profile is not active.");

    const task = await loadTask(text(formData, "taskId"));
    if (task.status !== "OPEN") fail("This task is no longer accepting quotes.");

    const amountPKR = int(formData, "amountPKR");
    const etaHours = int(formData, "etaHours");
    const scopeSummary = text(formData, "scopeSummary");
    const quoteText = text(formData, "quoteText");

    if (!amountPKR || Number.isNaN(amountPKR) || amountPKR < 500) fail("Quote at least PKR 500.");
    if (amountPKR > 5_000_000) fail("That amount looks too high. Double-check your quote.");
    if (!etaHours || Number.isNaN(etaHours) || etaHours < 1) fail("Enter how many hours the job will take.");
    if (scopeSummary.length < 10) fail("Summarise what your quote includes.");

    const cleanMessage = maskContactDetails(quoteText);
    const existing = await prisma.quote.findUnique({
      where: { taskId_taskerId: { taskId: task.id, taskerId: user.id } },
    });
    if (existing && existing.status !== "ACTIVE" && existing.status !== "WITHDRAWN") {
      fail("You can no longer change your quote on this task.");
    }

    const data = {
      amountPKR,
      etaHours,
      scopeSummary: maskContactDetails(scopeSummary).body,
      quoteText: cleanMessage.body,
      status: "ACTIVE" as const,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    await prisma.quote.upsert({
      where: { taskId_taskerId: { taskId: task.id, taskerId: user.id } },
      create: { ...data, taskId: task.id, taskerId: user.id },
      update: data,
    });
    refreshTask(task.id);
    return existing ? "Quote updated." : "Quote sent to the customer.";
  });
}

export async function withdrawQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const quote = await prisma.quote.findUnique({ where: { id: text(formData, "quoteId") } });
    if (!quote || quote.taskerId !== user.id) fail("Quote not found.");
    if (quote.status !== "ACTIVE") fail("Only pending quotes can be withdrawn.");
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "WITHDRAWN" } });
    refreshTask(quote.taskId);
    return "Quote withdrawn.";
  });
}

export async function acceptQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let taskId = "";
  const result = await runAction(async () => {
    const user = await signedInUser();
    const quote = await prisma.quote.findUnique({
      where: { id: text(formData, "quoteId") },
      include: { task: true },
    });
    if (!quote || quote.task.customerId !== user.id) fail("Quote not found.");
    if (quote.status !== "ACTIVE") fail("This quote is no longer available.");
    if (quote.expiresAt && quote.expiresAt < new Date()) fail("This quote has expired.");

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.task.updateMany({
        where: { id: quote.taskId, status: "OPEN" },
        data: { status: "ASSIGNED", taskerId: quote.taskerId },
      });
      if (claimed.count === 0) fail("This task has already been assigned.");
      await tx.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED" } });
      await tx.quote.updateMany({
        where: { taskId: quote.taskId, id: { not: quote.id }, status: "ACTIVE" },
        data: { status: "REJECTED" },
      });
    });
    taskId = quote.taskId;
    refreshTask(quote.taskId);
  });
  if (result?.error) return result;
  redirect(`/tasks/${taskId}/checkout`);
}

export async function fundEscrow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let taskId = "";
  const result = await runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.customerId !== user.id) fail("Only the customer can fund escrow.");
    if (task.status !== "ASSIGNED" || !task.taskerId) fail("This task is not waiting for payment.");
    if (task.escrowTransaction) fail("Escrow is already funded for this task.");

    const paymentMethod = text(formData, "paymentMethod");
    if (!PAYMENT_METHODS.some((method) => method.value === paymentMethod)) fail("Choose a payment method.");
    if (text(formData, "agree") !== "on") fail("Please accept the escrow terms.");

    const quote = await prisma.quote.findFirst({
      where: { taskId: task.id, taskerId: task.taskerId, status: "ACCEPTED" },
    });
    if (!quote) fail("No accepted quote found for this task.");

    // Payment gateway placeholder: a real JazzCash/Easypaisa/card integration
    // would confirm the charge via webhook before the escrow row is written.
    const paymentReference = `TM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const { commissionAmount, netAmount } = splitCommission(quote.amountPKR);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.task.updateMany({
        where: { id: task.id, status: "ASSIGNED" },
        data: { status: "ESCROW_ACTIVE" },
      });
      if (claimed.count === 0) fail("This task is not waiting for payment.");
      await tx.escrowTransaction.create({
        data: {
          taskId: task.id,
          customerId: user.id,
          taskerId: quote.taskerId,
          amount: quote.amountPKR,
          commissionPct: COMMISSION_PCT,
          commissionAmount,
          netAmount,
          status: "FUNDED",
          paymentMethod,
          paymentReference,
          escrowedAt: now,
        },
      });
      await tx.message.create({
        data: {
          taskId: task.id,
          senderId: user.id,
          channelType: "SYSTEM",
          body: `Escrow funded (ref ${paymentReference}). The address is now visible to the tasker and chat is open.`,
        },
      });
    });
    taskId = task.id;
    refreshTask(task.id);
  });
  if (result?.error) return result;
  redirect(`/tasks/${taskId}?paid=1`);
}

export async function startTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.taskerId !== user.id) fail("Only the assigned tasker can start this job.");
    if (task.status !== "ESCROW_ACTIVE") fail("The job can only start once escrow is funded.");
    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status: "IN_PROGRESS" } }),
      prisma.message.create({
        data: { taskId: task.id, senderId: user.id, channelType: "SYSTEM", body: "Tasker started the job." },
      }),
    ]);
    refreshTask(task.id);
    return "Job marked as started.";
  });
}

export async function markTaskerComplete(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.taskerId !== user.id) fail("Only the assigned tasker can mark this job done.");
    if (task.status !== "IN_PROGRESS" && task.status !== "ESCROW_ACTIVE") fail("This job is not in progress.");
    if (task.taskerCompletedAt) fail("You have already marked this job as done.");
    if (!task.escrowTransaction || task.escrowTransaction.status !== "FUNDED") fail("Escrow is not active.");

    const now = new Date();
    const autoReleaseAt = new Date(now.getTime() + AUTO_RELEASE_HOURS * 60 * 60 * 1000);
    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: { status: "IN_PROGRESS", taskerCompletedAt: now },
      }),
      prisma.escrowTransaction.update({
        where: { id: task.escrowTransaction.id },
        data: { autoReleaseAt },
      }),
      prisma.message.create({
        data: {
          taskId: task.id,
          senderId: user.id,
          channelType: "SYSTEM",
          body: `Tasker marked the job as done. Payment auto-releases in ${AUTO_RELEASE_HOURS} hours unless the customer confirms or raises a dispute.`,
        },
      }),
    ]);
    refreshTask(task.id);
    return "Marked as done. The customer has been asked to confirm.";
  });
}

export async function confirmCompletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.customerId !== user.id) fail("Only the customer can confirm completion.");
    if (task.status !== "IN_PROGRESS" && task.status !== "ESCROW_ACTIVE") fail("This task is not in progress.");
    if (!task.escrowTransaction) fail("No escrow found for this task.");

    const escrowId = task.escrowTransaction.id;
    const released = await prisma.$transaction((tx) =>
      releaseEscrow(tx, escrowId, user.id, "Customer confirmed completion. Payment released to the tasker."),
    );
    if (!released) fail("Escrow has already been settled.");
    refreshTask(task.id);
    return "Payment released. Please rate your tasker.";
  });
}

export async function raiseDispute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.customerId !== user.id && task.taskerId !== user.id) fail("You are not part of this task.");
    if (!task.escrowTransaction || task.escrowTransaction.status !== "FUNDED") {
      fail("Only tasks with funded escrow can be disputed.");
    }
    const reason = text(formData, "reason");
    if (reason.length < 15) fail("Explain the problem so our team can review it (at least 15 characters).");

    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status: "DISPUTED" } }),
      prisma.escrowTransaction.update({
        where: { id: task.escrowTransaction.id },
        data: { status: "DISPUTED", autoReleaseAt: null },
      }),
      prisma.message.create({
        data: {
          taskId: task.id,
          senderId: user.id,
          channelType: "SYSTEM",
          body: `Dispute raised by ${task.customerId === user.id ? "customer" : "tasker"}: ${maskContactDetails(reason).body}`,
        },
      }),
    ]);
    refreshTask(task.id);
    revalidatePath("/admin");
    return "Dispute raised. Escrow is frozen until our team resolves it.";
  });
}

export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.customerId !== user.id && task.taskerId !== user.id) fail("You are not part of this task.");
    if (!task.escrowTransaction) fail("Chat opens once escrow is funded.");
    if (!["ESCROW_ACTIVE", "IN_PROGRESS", "DISPUTED"].includes(task.status)) fail("This conversation is closed.");

    const raw = text(formData, "body");
    if (!raw) fail("Write a message first.");
    if (raw.length > 2000) fail("Messages are limited to 2,000 characters.");

    const { body, flagged } = maskContactDetails(raw);
    await prisma.message.create({
      data: {
        taskId: task.id,
        senderId: user.id,
        body,
        flagged,
        visibilityState: flagged ? "MASKED" : "ACTIVE",
      },
    });
    refreshTask(task.id);
    return flagged ? "Sent. Contact details were hidden to keep payments protected." : undefined;
  });
}

export async function rateTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await signedInUser();
    const task = await loadTask(text(formData, "taskId"));
    if (task.status !== "COMPLETED" || !task.taskerId) fail("You can rate once the task is completed.");

    const isTaskCustomer = task.customerId === user.id;
    if (!isTaskCustomer && task.taskerId !== user.id) fail("You are not part of this task.");
    const toUserId = isTaskCustomer ? task.taskerId : task.customerId;

    const scores = ["overall", "punctuality", "professionalism", "communication"].map((key) => int(formData, key));
    if (scores.some((score) => !score || Number.isNaN(score) || score < 1 || score > 5)) {
      fail("Give every score between 1 and 5 stars.");
    }
    const [overall, punctuality, professionalism, communication] = scores as number[];
    const comment = maskContactDetails(text(formData, "comment").slice(0, 1000)).body;

    const existing = await prisma.rating.findUnique({
      where: { taskId_fromUserId: { taskId: task.id, fromUserId: user.id } },
    });
    if (existing) fail("You have already rated this task.");

    await prisma.$transaction(async (tx) => {
      await tx.rating.create({
        data: {
          taskId: task.id,
          fromUserId: user.id,
          toUserId,
          overall,
          punctuality,
          professionalism,
          communication,
          comment: comment || null,
        },
      });
      if (isTaskCustomer) await recalculateTaskerRating(tx, toUserId);
    });
    refreshTask(task.id);
    revalidatePath(`/taskers/${toUserId}`);
    return "Thanks for your feedback!";
  });
}
