import { prisma } from "../db";
import { fail } from "../errors";
import type { Actor } from "./jobs";

export function parseSkills(raw: string) {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const part of raw.split(",")) {
    const skill = part.trim().replace(/\s+/g, " ");
    if (!skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    skills.push(skill);
  }
  return skills;
}

export function normalizeSkills(skills: string[]) {
  return skills.map((skill) => skill.toLowerCase());
}

export type CandidateProfileInput = {
  headline: string;
  summary: string;
  skills: string;
  experienceYears: number | null;
  isPublic: boolean;
};

/** Saves the signed-in candidate's own profile. The profile owner always comes from the session. */
export async function saveCandidateProfile(actor: Actor | null, input: CandidateProfileInput) {
  if (actor?.userType !== "CANDIDATE") fail("Candidate access required.");
  const headline = input.headline.trim();
  const summary = input.summary.trim();
  const skills = parseSkills(input.skills);
  const { experienceYears, isPublic } = input;
  if (headline.length > 120) fail("Headline must be 120 characters or fewer.");
  if (summary.length > 2000) fail("Summary must be 2,000 characters or fewer.");
  if (skills.length > 20 || skills.some((skill) => skill.length > 40)) fail("Add up to 20 skills, each 40 characters or fewer.");
  if (Number.isNaN(experienceYears) || (experienceYears !== null && (experienceYears < 0 || experienceYears > 60))) {
    fail("Experience must be a whole number between 0 and 60 years.");
  }
  const data = {
    headline: headline || null,
    summary: summary || null,
    skills,
    skillsNormalized: normalizeSkills(skills),
    experienceYears,
    isPublic,
  };
  await prisma.candidateProfile.upsert({ where: { userId: actor.id }, create: { userId: actor.id, ...data }, update: data });
}

export type EmployerProfileInput = { companyName: string; industry: string; website: string; description: string };

/** Saves the signed-in employer's own company profile. */
export async function saveEmployerProfile(actor: Actor | null, input: EmployerProfileInput) {
  if (actor?.userType !== "EMPLOYER") fail("Employer access required.");
  const companyName = input.companyName.trim();
  const industry = input.industry.trim();
  const website = input.website.trim();
  const description = input.description.trim();
  if (companyName.length < 2 || companyName.length > 120) fail("Company name must be between 2 and 120 characters.");
  if (industry.length > 100) fail("Industry must be 100 characters or fewer.");
  if (description.length > 2000) fail("Company description must be 2,000 characters or fewer.");
  if (website && (website.length > 200 || !/^https:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(website))) {
    fail("Enter a valid https:// company website.");
  }
  const data = { companyName, industry: industry || null, website: website || null, description: description || null };
  await prisma.$transaction([
    prisma.employerProfile.upsert({ where: { userId: actor.id }, create: { userId: actor.id, ...data }, update: data }),
    prisma.user.update({ where: { id: actor.id }, data: { businessName: companyName } }),
  ]);
}
