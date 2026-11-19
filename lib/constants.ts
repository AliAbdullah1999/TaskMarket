export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Connect HR";

/** Monthly membership prices in PKR. Payment is collected outside the app and confirmed by an administrator. */
export const PLAN_PRICES = {
  CANDIDATE_PRO: 1499,
  EMPLOYER_GROWTH: 9999,
} as const;

export const FREE_APPLICATION_LIMIT = 3;
export const FREE_ACTIVE_JOB_LIMIT = 1;
export const GROWTH_ACTIVE_JOB_LIMIT = 5;

/** Memberships and job listings both run for 30 days. */
export const MEMBERSHIP_DAYS = 30;
export const JOB_LISTING_DAYS = 30;
/** A member may request a renewal this many days before their membership ends. */
export const RENEWAL_WINDOW_DAYS = 7;

export const PAGE_SIZE = 12;

/** The plan catalogue. Benefits listed here are the only ones the app implements. */
export const PLANS = {
  CANDIDATE_PRO: {
    plan: "CANDIDATE_PRO",
    role: "CANDIDATE",
    audience: "For candidates",
    name: "Candidate Pro",
    price: PLAN_PRICES.CANDIDATE_PRO,
    description: "Apply to as many roles as you like, without the free monthly cap.",
    benefits: ["Unlimited job applications while your membership is active"],
    freeName: "Candidate Free",
    freeBenefits: [`Up to ${FREE_APPLICATION_LIMIT} job applications per calendar month`],
  },
  EMPLOYER_GROWTH: {
    plan: "EMPLOYER_GROWTH",
    role: "EMPLOYER",
    audience: "For employers",
    name: "Employer Growth",
    price: PLAN_PRICES.EMPLOYER_GROWTH,
    description: "Hire for more roles at once and search candidates who have shared their profiles.",
    benefits: [`Up to ${GROWTH_ACTIVE_JOB_LIMIT} active job listings`, "Search candidate profiles shared with employers"],
    freeName: "Employer Free",
    freeBenefits: [`${FREE_ACTIVE_JOB_LIMIT} active job listing at a time`],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const JOB_CATEGORIES = [
  "Administration",
  "Customer Service",
  "Design",
  "Education",
  "Engineering",
  "Finance",
  "Healthcare",
  "Human Resources",
  "Information Technology",
  "Marketing",
  "Sales",
  "Other",
] as const;

/** Legacy marketplace settings retained for existing records and routes. */
export const COMMISSION_PCT = 11;

/** Escrow auto-releases this many hours after the tasker marks a job complete. */
export const AUTO_RELEASE_HOURS = 48;

export const CATEGORIES = [
  "Home Care",
  "Handyman",
  "Tutoring",
  "Freelance",
  "Digital Services",
] as const;

export const CATEGORY_DESCRIPTIONS: Record<(typeof CATEGORIES)[number], string> = {
  "Home Care": "Cleaning, cooking, laundry and domestic help.",
  Handyman: "Plumbing, electrical, carpentry and repairs.",
  Tutoring: "School, O/A-Level, Quran and language tutors.",
  Freelance: "Writing, admin support, research and translation.",
  "Digital Services": "Design, websites, social media and video.",
};

export const CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Remote",
] as const;

export const PAYMENT_METHODS = [
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "card", label: "Debit / credit card" },
  { value: "bank_transfer", label: "Bank transfer (IBFT)" },
] as const;

export const TIME_ZONE = "Asia/Karachi";
