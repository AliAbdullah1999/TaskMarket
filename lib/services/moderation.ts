import { prisma } from "../db";
import { fail } from "../errors";
import { notifyJobRemoved } from "../notifications";
import type { Actor } from "./jobs";
import { logAdminAction, requireAdmin } from "./memberships";

/**
 * Takes a job listing down. The listing becomes ARCHIVED: it disappears from public
 * pages, stops accepting applications and can no longer be edited. Applications
 * already received are kept. The employer is told the reason, and the action is audited.
 */
export async function removeJobAsAdmin(actor: Actor | null, input: { jobId: string; reason: string }) {
  requireAdmin(actor);
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) fail("Enter the reason for removal (5–500 characters). It is sent to the employer.");

  await prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: input.jobId }, select: { id: true, status: true, employerId: true, title: true } });
    if (!job) fail("Job not found.");
    const updated = await tx.job.updateMany({
      where: { id: job.id, status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", removedReason: reason },
    });
    if (!updated.count) fail("This listing has already been removed.");
    await logAdminAction(tx, actor.id, "JOB_REMOVED", { type: "Job", id: job.id }, {
      employerId: job.employerId,
      title: job.title,
      previousStatus: job.status,
      reason,
    });
  });
  await notifyJobRemoved(input.jobId);
}
