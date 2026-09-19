import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { AUTO_RELEASE_HOURS, COMMISSION_PCT } from "@/lib/constants";

export const metadata: Metadata = { title: "Trust & safety" };

const SECTIONS = [
  {
    title: "NTN before quoting",
    points: [
      "Every tasker submits an NTN (or CNIC registered with FBR) during onboarding.",
      "Our team verifies it before the tasker can send a quote or receive a payout.",
      "Changing an NTN puts the profile back into review.",
    ],
  },
  {
    title: "Escrow before execution",
    points: [
      "Customers pay the accepted quote into escrow before any work begins.",
      `Funds release when the customer confirms, or automatically ${AUTO_RELEASE_HOURS} hours after the tasker marks the job done.`,
      "Either side can raise a dispute before release, which freezes the funds until our team decides.",
    ],
  },
  {
    title: "Masked communication",
    points: [
      "Home addresses are encrypted and revealed only to the hired tasker after escrow is funded.",
      "Chat opens only once escrow is funded and closes when the job ends.",
      "Phone numbers, emails and off-platform app handles are hidden automatically in quotes, bios and messages.",
    ],
  },
  {
    title: "FBR-ready ledger",
    points: [
      `Every release records gross sale, ${COMMISSION_PCT}% commission and net payout against the seller's NTN.`,
      "Monthly per-seller summaries can be exported as CSV for withholding and reporting.",
      "Payouts are tracked from pending to paid with timestamps.",
    ],
  },
];

export default function CompliancePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow="Trust & safety"
        title="How we protect customers and taskers"
        description="The marketplace is built around four controls that keep payments safe and keep sellers compliant with Pakistani tax rules."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <div key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {section.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
