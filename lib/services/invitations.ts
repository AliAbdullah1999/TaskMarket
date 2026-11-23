import { prisma } from "../db";
import { assertEmailVerified, canSearchCandidates, isJobAcceptingApplications } from "../entitlements";
import { fail } from "../errors";
import { notifyInvitation } from "../notifications";
import { RATE_LIMITS, enforceRateLimit, rateLimitKey } from "../rate-limit";
import { isUniqueViolation } from "../transactions";
import { SEARCHABLE_CANDIDATE_WHERE } from "./candidates";
import type { Actor } from "./jobs";

/**
 * Invites a candidate found in employer search to apply to one of the employer's
 * open jobs. This is how an employer reaches a searched candidate: the candidate is
 * emailed and sees the invitation in the app, and the employer never receives the
 * candidate's contact details unless the candidate then applies.
 */
export async function inviteCandidateToJob(
  actor: Actor | null,
  input: { profileId: string; jobId: string; message: string },
  now = new Date(),
) {
  if (!actor) fail("Please log in to continue.");
  if (actor.userType !== "EMPLOYER") fail("Only employer accounts can invite candidates.");
  const message = input.message.trim();
  if (message.length > 500) fail("Your message must be 500 characters or fewer.");
  if (!(await canSearchCandidates(prisma, actor.id, now))) fail("Inviting candidates is included with Employer Growth.");
  await assertEmailVerified(prisma, actor.id, "inviting candidates");

  const job = await prisma.job.findFirst({
    where: { id: input.jobId, employerId: actor.id },
    select: { id: true, status: true, expiresAt: true },
  });
  if (!job) fail("Choose one of your own job listings.");
  if (!isJobAcceptingApplications(job, now)) fail("That job is no longer accepting applications. Choose an open listing.");

  // Private profiles and inactive accounts behave exactly like profiles that do not exist.
  const profile = await prisma.candidateProfile.findFirst({
    where: { AND: [{ id: input.profileId }, SEARCHABLE_CANDIDATE_WHERE] },
    select: { userId: true },
  });
  if (!profile) fail("This candidate profile is no longer available.");

  const [applied, invited] = await Promise.all([
    prisma.jobApplication.findUnique({ where: { jobId_candidateId: { jobId: job.id, candidateId: profile.userId } }, select: { id: true } }),
    prisma.jobInvitation.findUnique({ where: { jobId_candidateId: { jobId: job.id, candidateId: profile.userId } }, select: { id: true } }),
  ]);
  if (applied) fail("This candidate has already applied to that job.");
  if (invited) fail("You have already invited this candidate to that job.");

  await enforceRateLimit(rateLimitKey("candidate-invite", actor.id), RATE_LIMITS.candidateInvites, now);

  let invitation;
  try {
    invitation = await prisma.jobInvitation.create({
      data: { jobId: job.id, employerId: actor.id, candidateId: profile.userId, message: message || null },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) fail("You have already invited this candidate to that job.");
    throw error;
  }
  await notifyInvitation(invitation.id);
  return invitation;
}

/** Invitations a candidate can still act on: the job is open and they have not applied yet. */
export function getOpenInvitationsForCandidate(candidateId: string, now = new Date()) {
  return prisma.jobInvitation.findMany({
    where: {
      candidateId,
      job: {
        status: "OPEN",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        employer: { status: "ACTIVE" },
        applications: { none: { candidateId } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      message: true,
      createdAt: true,
      job: { select: { id: true, title: true, city: true, employer: { select: { fullName: true, employerProfile: { select: { companyName: true } } } } } },
    },
  });
}
