import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { expireLapsedMemberships, getMembershipOverview, hasActivePlan } from "../lib/entitlements";
import {
  cancelMembershipRequest,
  requestMembership,
  reviewMembershipRequest,
  setAccountStatus,
} from "../lib/services/memberships";
import { addDays } from "../lib/time";
import { activateMembership, createUser, prisma, rejectsWith, resetDb } from "./helpers";

beforeEach(resetDb);
after(() => prisma.$disconnect());

const approve = (subscriptionId: string, ref = "IBFT-778812") => ({ subscriptionId, decision: "approve", paymentReference: ref, note: "" });

describe("membership requests", () => {
  test("a request is recorded but grants nothing until approved", async () => {
    const candidate = await createUser("CANDIDATE");
    const { id } = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "JC-12345" });
    const request = await prisma.subscription.findUniqueOrThrow({ where: { id } });
    assert.equal(request.status, "REQUESTED");
    assert.equal(request.requestedReference, "JC-12345");
    assert.equal(await hasActivePlan(prisma, candidate.id, "CANDIDATE_PRO"), false);
  });

  test("users can only request the plan for their own role", async () => {
    const candidate = await createUser("CANDIDATE");
    const employer = await createUser("EMPLOYER");
    const admin = await createUser("ADMIN");
    await rejectsWith(requestMembership(candidate, { plan: "EMPLOYER_GROWTH", reference: "" }), /not available/);
    await rejectsWith(requestMembership(employer, { plan: "CANDIDATE_PRO", reference: "" }), /not available/);
    await rejectsWith(requestMembership(admin, { plan: "CANDIDATE_PRO", reference: "" }), /does not have membership/);
    await rejectsWith(requestMembership(null, { plan: "CANDIDATE_PRO", reference: "" }), /log in/);
  });

  test("conflicting requests are prevented, including concurrent ones", async () => {
    const employer = await createUser("EMPLOYER");
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => requestMembership(employer, { plan: "EMPLOYER_GROWTH", reference: "" })),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    await rejectsWith(requestMembership(employer, { plan: "EMPLOYER_GROWTH", reference: "" }), /awaiting review/);
  });

  test("an active member cannot request again until the renewal window", async () => {
    const candidate = await createUser("CANDIDATE");
    await activateMembership(candidate.id, "CANDIDATE_PRO", { start: new Date(), end: addDays(new Date(), 20) });
    await rejectsWith(requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" }), /already have an active plan/);
  });

  test("users can cancel only their own pending request", async () => {
    const candidate = await createUser("CANDIDATE");
    const other = await createUser("CANDIDATE");
    const { id } = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" });
    await rejectsWith(cancelMembershipRequest(other, id), /already been reviewed or cancelled/);
    await cancelMembershipRequest(candidate, id);
    assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id } })).status, "CANCELLED");
  });

  test("rejects malformed payment references", async () => {
    const candidate = await createUser("CANDIDATE");
    await rejectsWith(requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "<script>" }), /Payment reference/);
  });
});

describe("admin review", () => {
  test("approval activates a 30-day membership and records who approved it", async () => {
    const admin = await createUser("ADMIN");
    const employer = await createUser("EMPLOYER");
    const { id } = await requestMembership(employer, { plan: "EMPLOYER_GROWTH", reference: "" });
    const now = new Date("2026-11-17T12:00:00Z");
    await reviewMembershipRequest(admin, approve(id), now);
    const membership = await prisma.subscription.findUniqueOrThrow({ where: { id } });
    assert.equal(membership.status, "ACTIVE");
    assert.equal(membership.paymentReference, "IBFT-778812");
    assert.equal(membership.reviewedById, admin.id);
    assert.equal(membership.currentPeriodStart?.toISOString(), now.toISOString());
    assert.equal(membership.currentPeriodEnd?.toISOString(), "2026-12-17T12:00:00.000Z");
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { targetId: id } });
    assert.equal(log.action, "MEMBERSHIP_APPROVED");
    assert.equal(log.adminId, admin.id);
  });

  test("approval requires a payment reference", async () => {
    const admin = await createUser("ADMIN");
    const candidate = await createUser("CANDIDATE");
    const { id } = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" });
    await rejectsWith(reviewMembershipRequest(admin, approve(id, "")), /payment reference/);
  });

  test("non-admins cannot approve, including their own request", async () => {
    const candidate = await createUser("CANDIDATE");
    const employer = await createUser("EMPLOYER");
    const { id } = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" });
    await rejectsWith(reviewMembershipRequest(candidate, approve(id)), /Admin access/);
    await rejectsWith(reviewMembershipRequest(employer, approve(id)), /Admin access/);
    await rejectsWith(reviewMembershipRequest(null, approve(id)), /Admin access/);
    assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id } })).status, "REQUESTED");
  });

  test("rejected and cancelled requests can never be activated", async () => {
    const admin = await createUser("ADMIN");
    const candidate = await createUser("CANDIDATE");
    const first = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" });
    await reviewMembershipRequest(admin, { subscriptionId: first.id, decision: "reject", paymentReference: "", note: "No payment found" });
    const rejected = await prisma.subscription.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.reviewNote, "No payment found");
    await rejectsWith(reviewMembershipRequest(admin, approve(first.id)), /already been reviewed/);

    const second = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" });
    await cancelMembershipRequest(candidate, second.id);
    await rejectsWith(reviewMembershipRequest(admin, approve(second.id)), /already been reviewed/);
    assert.equal(await hasActivePlan(prisma, candidate.id, "CANDIDATE_PRO"), false);
  });

  test("a renewal approved early starts when the current period ends", async () => {
    const admin = await createUser("ADMIN");
    const candidate = await createUser("CANDIDATE");
    const currentEnd = addDays(new Date(), 3);
    await activateMembership(candidate.id, "CANDIDATE_PRO", { start: addDays(currentEnd, -30), end: currentEnd });
    const overview = await getMembershipOverview(prisma, candidate.id, "CANDIDATE_PRO");
    assert.equal(overview.canRequest, true);

    const { id } = await requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" });
    await reviewMembershipRequest(admin, approve(id));
    const renewal = await prisma.subscription.findUniqueOrThrow({ where: { id } });
    assert.equal(renewal.currentPeriodStart?.getTime(), currentEnd.getTime());
    assert.equal(renewal.currentPeriodEnd?.getTime(), addDays(currentEnd, 30).getTime());
    await rejectsWith(requestMembership(candidate, { plan: "CANDIDATE_PRO", reference: "" }), /renewal has already been approved/);
  });
});

describe("expiry", () => {
  test("benefits end at the period end and lapsed memberships are marked EXPIRED", async () => {
    const employer = await createUser("EMPLOYER");
    const membership = await activateMembership(employer.id, "EMPLOYER_GROWTH", { start: addDays(new Date(), -30), end: addDays(new Date(), 1) });
    assert.equal(await hasActivePlan(prisma, employer.id, "EMPLOYER_GROWTH"), true);
    const later = addDays(new Date(), 2);
    assert.equal(await hasActivePlan(prisma, employer.id, "EMPLOYER_GROWTH", later), false);
    assert.equal(await expireLapsedMemberships(prisma, later), 1);
    assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { id: membership.id } })).status, "EXPIRED");
  });
});

describe("account administration", () => {
  test("admins can suspend and reactivate member accounts, with an audit trail", async () => {
    const admin = await createUser("ADMIN");
    const candidate = await createUser("CANDIDATE");
    await setAccountStatus(admin, { userId: candidate.id, status: "SUSPENDED" });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: candidate.id } })).status, "SUSPENDED");
    await setAccountStatus(admin, { userId: candidate.id, status: "ACTIVE" });
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: candidate.id } })).status, "ACTIVE");
    const actions = await prisma.adminAuditLog.findMany({ where: { targetId: candidate.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(actions.map((a) => a.action), ["ACCOUNT_SUSPENDED", "ACCOUNT_REACTIVATED"]);
  });

  test("non-admins cannot suspend anyone, and admins cannot be suspended from the console", async () => {
    const admin = await createUser("ADMIN");
    const otherAdmin = await createUser("ADMIN");
    const employer = await createUser("EMPLOYER");
    const candidate = await createUser("CANDIDATE");
    await rejectsWith(setAccountStatus(employer, { userId: candidate.id, status: "SUSPENDED" }), /Admin access/);
    await rejectsWith(setAccountStatus(admin, { userId: otherAdmin.id, status: "SUSPENDED" }), /Administrator accounts/);
    await rejectsWith(setAccountStatus(admin, { userId: admin.id, status: "SUSPENDED" }), /your own/);
    await rejectsWith(setAccountStatus(admin, { userId: "missing", status: "SUSPENDED" }), /not found/);
    await rejectsWith(setAccountStatus(admin, { userId: candidate.id, status: "BANNED" }), /Unknown account status/);
  });
});
