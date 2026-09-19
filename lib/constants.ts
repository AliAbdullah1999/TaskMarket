export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "TaskMarket PK";

/** Platform commission taken from the tasker's side of every released escrow. */
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
