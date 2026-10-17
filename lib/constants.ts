export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "CareerMarket PK";

/** Proposed monthly membership prices. Payment processing is not yet connected. */
export const PLAN_PRICES = {
  CANDIDATE_PRO: 1499,
  EMPLOYER_GROWTH: 9999,
} as const;

export const FREE_APPLICATION_LIMIT = 3;
export const FREE_ACTIVE_JOB_LIMIT = 1;
export const GROWTH_ACTIVE_JOB_LIMIT = 5;

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
