import { APP_NAME } from "./constants";
import { prisma } from "./db";
import { appUrl, sendEmail } from "./email";
import { applicationStatusMeta, formatDate, planLabels } from "./format";

/**
 * Transactional emails about activity on the platform. Each function loads what it
 * needs by id and is called after the change is committed. Failures are logged and
 * swallowed: a notification must never undo or block the action it reports.
 */
async function safely(label: string, send: () => Promise<unknown>) {
  try {
    await send();
  } catch (error) {
    console.error(`[notify] ${label} failed`, error);
  }
}

const EMPLOYER_NAME = { select: { fullName: true, email: true, employerProfile: { select: { companyName: true } } } } as const;

function companyOf(employer: { fullName: string; employerProfile: { companyName: string } | null }) {
  return employer.employerProfile?.companyName ?? employer.fullName;
}

/** Tells the employer that a candidate applied. Contact details stay inside the app. */
export function notifyApplicationReceived(applicationId: string) {
  return safely("application received", async () => {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: { job: { select: { id: true, title: true } }, candidate: { select: { fullName: true } }, employer: EMPLOYER_NAME },
    });
    if (!application) return;
    await sendEmail({
      to: application.employer.email,
      subject: `New application for ${application.job.title}`,
      text: `${application.candidate.fullName} applied for "${application.job.title}".\n\nReview the application:\n${appUrl(`/jobs/${application.job.id}`)}`,
    });
  });
}

/** Tells the candidate that the employer moved their application to a new status. */
export function notifyApplicationStatus(applicationId: string) {
  return safely("application status", async () => {
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      select: { status: true, job: { select: { title: true } }, candidate: { select: { fullName: true, email: true } }, employer: EMPLOYER_NAME },
    });
    if (!application) return;
    const label = applicationStatusMeta[application.status]?.label ?? application.status;
    await sendEmail({
      to: application.candidate.email,
      subject: `Update on your application for ${application.job.title}`,
      text: `Hi ${application.candidate.fullName},\n\n${companyOf(application.employer)} updated your application for "${application.job.title}".\n\nNew status: ${label}\n\nTrack all your applications:\n${appUrl("/applications")}`,
    });
  });
}

export function notifyMembershipReviewed(subscriptionId: string) {
  return safely("membership reviewed", async () => {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, reviewNote: true, user: { select: { fullName: true, email: true } } },
    });
    if (!subscription || (subscription.status !== "ACTIVE" && subscription.status !== "REJECTED")) return;
    const plan = planLabels[subscription.plan];
    const approved = subscription.status === "ACTIVE";
    await sendEmail({
      to: subscription.user.email,
      subject: approved ? `Your ${plan} membership is active` : `Your ${plan} request was not approved`,
      text: approved
        ? `Hi ${subscription.user.fullName},\n\nYour payment was confirmed and ${plan} is active from ${formatDate(subscription.currentPeriodStart)} to ${formatDate(subscription.currentPeriodEnd)}.\n\n${appUrl("/pricing")}`
        : `Hi ${subscription.user.fullName},\n\nWe could not approve your ${plan} request.${subscription.reviewNote ? `\n\nReason: ${subscription.reviewNote}` : ""}\n\nYou can submit a new request at any time:\n${appUrl("/pricing")}`,
    });
  });
}

export function notifyRenewalDue(subscriptionId: string) {
  return safely("renewal reminder", async () => {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { plan: true, currentPeriodEnd: true, user: { select: { fullName: true, email: true } } },
    });
    if (!subscription) return;
    const plan = planLabels[subscription.plan];
    await sendEmail({
      to: subscription.user.email,
      subject: `Your ${plan} membership ends on ${formatDate(subscription.currentPeriodEnd)}`,
      text: `Hi ${subscription.user.fullName},\n\nYour ${plan} membership ends on ${formatDate(subscription.currentPeriodEnd)}. To keep your benefits without a gap, request a renewal now; the new period starts when the current one ends.\n\n${appUrl("/pricing")}`,
    });
  });
}

export function notifyJobRemoved(jobId: string) {
  return safely("job removed", async () => {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { title: true, removedReason: true, employer: EMPLOYER_NAME } });
    if (!job) return;
    await sendEmail({
      to: job.employer.email,
      subject: `Your listing "${job.title}" was removed`,
      text: `Hi ${job.employer.fullName},\n\nOur team removed your job listing "${job.title}" from ${APP_NAME}.\n\nReason: ${job.removedReason ?? "It did not meet our listing rules."}\n\nIf you believe this was a mistake, reply to this email or contact support. Our listing rules are in the Terms of Service:\n${appUrl("/terms")}`,
    });
  });
}

/** Tells a candidate that an employer invited them to apply. The employer never sees the candidate's address. */
export function notifyInvitation(invitationId: string) {
  return safely("invitation", async () => {
    const invitation = await prisma.jobInvitation.findUnique({
      where: { id: invitationId },
      select: { message: true, job: { select: { id: true, title: true, city: true } }, candidate: { select: { fullName: true, email: true } }, employer: EMPLOYER_NAME },
    });
    if (!invitation) return;
    const company = companyOf(invitation.employer);
    await sendEmail({
      to: invitation.candidate.email,
      subject: `${company} invited you to apply: ${invitation.job.title}`,
      text: `Hi ${invitation.candidate.fullName},\n\n${company} found your profile on ${APP_NAME} and invited you to apply for "${invitation.job.title}" (${invitation.job.city}).${invitation.message ? `\n\nTheir message:\n${invitation.message}` : ""}\n\nView the job and apply:\n${appUrl(`/jobs/${invitation.job.id}`)}\n\nYou received this because your profile is visible in employer search. You can turn that off from your profile at any time.`,
    });
  });
}
