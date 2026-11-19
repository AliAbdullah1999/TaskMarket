import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { canSearchCandidates } from "../lib/entitlements";
import { getSearchableCandidate, searchCandidates } from "../lib/services/candidates";
import { saveCandidateProfile, saveEmployerProfile } from "../lib/services/profiles";
import { activateMembership, createUser, prisma, rejectsWith, resetDb } from "./helpers";

beforeEach(resetDb);
after(() => prisma.$disconnect());

async function candidate(opts: { name: string; city?: string; isPublic: boolean; skills?: string[]; years?: number; status?: "ACTIVE" | "SUSPENDED" }) {
  const user = await createUser("CANDIDATE", { fullName: opts.name, city: opts.city ?? "Karachi", status: opts.status });
  await saveCandidateProfile(user, {
    headline: `${opts.name} headline`,
    summary: "",
    skills: (opts.skills ?? []).join(", "),
    experienceYears: opts.years ?? null,
    isPublic: opts.isPublic,
  });
  return prisma.candidateProfile.findUniqueOrThrow({ where: { userId: user.id } });
}

describe("candidate search access", () => {
  test("requires an active Employer Growth membership", async () => {
    const employer = await createUser("EMPLOYER");
    assert.equal(await canSearchCandidates(prisma, employer.id), false);
    await prisma.subscription.create({ data: { userId: employer.id, plan: "EMPLOYER_GROWTH", status: "REQUESTED" } });
    assert.equal(await canSearchCandidates(prisma, employer.id), false);
    await activateMembership(employer.id, "EMPLOYER_GROWTH");
    assert.equal(await canSearchCandidates(prisma, employer.id), true);
  });
});

describe("candidate search results", () => {
  test("only public, active candidate profiles appear", async () => {
    await candidate({ name: "Visible Person", isPublic: true });
    const hidden = await candidate({ name: "Private Person", isPublic: false });
    await candidate({ name: "Suspended Person", isPublic: true, status: "SUSPENDED" });
    const result = await searchCandidates({});
    assert.deepEqual(result.items.map((c) => c.user.fullName), ["Visible Person"]);
    assert.equal(await getSearchableCandidate(hidden.id), null);
  });

  test("results never include email, phone or account fields", async () => {
    const profile = await candidate({ name: "Public Person", isPublic: true });
    const [item] = (await searchCandidates({})).items;
    assert.deepEqual(Object.keys(item.user).sort(), ["city", "fullName"]);
    assert.ok(!("userId" in item));
    const single = await getSearchableCandidate(profile.id);
    assert.deepEqual(Object.keys(single!.user).sort(), ["city", "fullName"]);
  });

  test("filters by keyword, skill, city and minimum experience together", async () => {
    await candidate({ name: "Sara React", city: "Lahore", isPublic: true, skills: ["React", "TypeScript"], years: 5 });
    await candidate({ name: "Ali React", city: "Karachi", isPublic: true, skills: ["React"], years: 1 });
    await candidate({ name: "Zain Finance", city: "Lahore", isPublic: true, skills: ["Accounting"], years: 8 });
    const names = async (search: Parameters<typeof searchCandidates>[0]) => (await searchCandidates(search)).items.map((c) => c.user.fullName).sort();
    assert.deepEqual(await names({ skill: "react" }), ["Ali React", "Sara React"]);
    assert.deepEqual(await names({ q: "typescript" }), ["Sara React"]);
    assert.deepEqual(await names({ skill: "React", city: "Lahore" }), ["Sara React"]);
    assert.deepEqual(await names({ minExperience: 5 }), ["Sara React", "Zain Finance"]);
    assert.deepEqual(await names({ q: "zain" }), ["Zain Finance"]);
  });

  test("paginates results", async () => {
    for (let i = 0; i < 14; i += 1) await candidate({ name: `Person ${i}`, isPublic: true });
    const first = await searchCandidates({ page: 1 });
    const second = await searchCandidates({ page: 2 });
    assert.equal(first.total, 14);
    assert.equal(first.pageCount, 2);
    assert.equal(first.items.length, 12);
    assert.equal(second.items.length, 2);
    const ids = new Set([...first.items, ...second.items].map((c) => c.id));
    assert.equal(ids.size, 14);
  });
});

describe("profile ownership and visibility", () => {
  test("a candidate controls their own visibility", async () => {
    const user = await createUser("CANDIDATE", { fullName: "Toggle Person" });
    const input = { headline: "Analyst", summary: "", skills: "Excel, SQL, excel", experienceYears: 3, isPublic: true };
    await saveCandidateProfile(user, input);
    const saved = await prisma.candidateProfile.findUniqueOrThrow({ where: { userId: user.id } });
    assert.deepEqual(saved.skills, ["Excel", "SQL"]);
    assert.deepEqual(saved.skillsNormalized, ["excel", "sql"]);
    assert.equal((await searchCandidates({})).total, 1);
    await saveCandidateProfile(user, { ...input, isPublic: false });
    assert.equal((await searchCandidates({})).total, 0);
  });

  test("profile saves are scoped to the signed-in account and role", async () => {
    const employer = await createUser("EMPLOYER");
    const candidateUser = await createUser("CANDIDATE");
    await rejectsWith(saveCandidateProfile(employer, { headline: "x", summary: "", skills: "", experienceYears: null, isPublic: true }), /Candidate access/);
    await rejectsWith(saveEmployerProfile(candidateUser, { companyName: "Fake Co", industry: "", website: "", description: "" }), /Employer access/);
    await rejectsWith(saveEmployerProfile(employer, { companyName: "Real Co", industry: "", website: "http://insecure.pk", description: "" }), /https/);
    await saveEmployerProfile(employer, { companyName: "Real Co", industry: "Retail", website: "https://real.pk", description: "" });
    const profile = await prisma.employerProfile.findUniqueOrThrow({ where: { userId: employer.id } });
    assert.equal(profile.companyName, "Real Co");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: employer.id } })).businessName, "Real Co");
  });
});
