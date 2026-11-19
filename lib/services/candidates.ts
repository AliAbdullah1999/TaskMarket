import type { Prisma } from "@prisma/client";
import { PAGE_SIZE } from "../constants";
import { prisma } from "../db";

/** Only these fields ever leave the database for employer search. No email, phone or account data. */
export const PUBLIC_CANDIDATE_SELECT = {
  id: true,
  headline: true,
  summary: true,
  skills: true,
  experienceYears: true,
  updatedAt: true,
  user: { select: { fullName: true, city: true } },
} satisfies Prisma.CandidateProfileSelect;

/** A profile is searchable only when the candidate opted in and the account is an active candidate. */
export const SEARCHABLE_CANDIDATE_WHERE: Prisma.CandidateProfileWhereInput = {
  isPublic: true,
  user: { status: "ACTIVE", userType: "CANDIDATE" },
};

export type CandidateSearch = { q?: string; city?: string; skill?: string; minExperience?: number | null; page?: number };

export async function searchCandidates(search: CandidateSearch) {
  const q = (search.q ?? "").trim().slice(0, 100);
  const skill = (search.skill ?? "").trim().slice(0, 40);
  const city = (search.city ?? "").trim();
  const minExperience = search.minExperience != null && search.minExperience > 0 ? Math.min(60, search.minExperience) : null;

  const filters: Prisma.CandidateProfileWhereInput[] = [SEARCHABLE_CANDIDATE_WHERE];
  if (city) filters.push({ user: { city } });
  if (minExperience !== null) filters.push({ experienceYears: { gte: minExperience } });
  if (skill) filters.push({ skillsNormalized: { has: skill.toLowerCase() } });
  if (q) {
    filters.push({
      OR: [
        { headline: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { user: { fullName: { contains: q, mode: "insensitive" } } },
        { skillsNormalized: { has: q.toLowerCase() } },
      ],
    });
  }
  const where: Prisma.CandidateProfileWhereInput = { AND: filters };

  const total = await prisma.candidateProfile.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(search.page ?? 1)), pageCount);
  const items = await prisma.candidateProfile.findMany({
    where,
    select: PUBLIC_CANDIDATE_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return { items, total, page, pageCount };
}

export function getSearchableCandidate(profileId: string) {
  return prisma.candidateProfile.findFirst({
    where: { AND: [{ id: profileId }, SEARCHABLE_CANDIDATE_WHERE] },
    select: PUBLIC_CANDIDATE_SELECT,
  });
}
