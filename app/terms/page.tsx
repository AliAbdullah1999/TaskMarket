import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage, LegalSection } from "@/components/legal";
import { APP_NAME, FREE_ACTIVE_JOB_LIMIT, FREE_APPLICATION_LIMIT, JOB_LISTING_DAYS, LEGAL_ENTITY, MEMBERSHIP_DAYS, MINIMUM_AGE, PLANS } from "@/lib/constants";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The rules for using ${APP_NAME} as a candidate or an employer.`,
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms are an agreement between you and ${LEGAL_ENTITY} ("${APP_NAME}", "we", "us"). By creating an account or using this website, you agree to them. If you do not agree, please do not use the service.`}
    >
      <LegalSection id="service" title="1. What the service is">
        <p>
          {APP_NAME} is an online platform where employers publish job listings and candidates apply for them. We provide the platform only. We are not an employer, a recruitment agency, or a party to any employment arrangement between a candidate and an employer, and we do not guarantee that any candidate will find work or that any employer will find a suitable hire.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="2. Who can use it">
        <ul>
          <li>You must be at least {MINIMUM_AGE} years old.</li>
          <li>You must give accurate information and keep it up to date.</li>
          <li>One person or organization should not create multiple accounts to get around plan limits or a suspension.</li>
        </ul>
      </LegalSection>

      <LegalSection id="account" title="3. Your account">
        <ul>
          <li>You are responsible for keeping your password confidential and for activity on your account.</li>
          <li>Tell us promptly if you think someone else has accessed your account.</li>
          <li>You can delete your account at any time from Account settings.</li>
        </ul>
      </LegalSection>

      <LegalSection id="candidates" title="4. Rules for candidates">
        <ul>
          <li>Your profile and applications must be truthful and describe your own experience and qualifications.</li>
          <li>When you apply for a job, the employer receives your name, email address, city, career profile and cover letter, as described in our <Link href="/privacy" className="font-semibold text-emerald-800 hover:underline">Privacy Policy</Link>.</li>
          <li>You decide whether your profile appears in employer search. It is private unless you turn visibility on.</li>
          <li>Never pay an employer or anyone else for a job offer, interview or application. Genuine employers do not charge candidates. Report any listing that asks for payment.</li>
        </ul>
      </LegalSection>

      <LegalSection id="employers" title="5. Rules for employers">
        <ul>
          <li>Post only genuine vacancies for real positions that you are authorized to fill.</li>
          <li>Listings must be accurate about the role, location, employment type and pay, and must comply with the laws of Pakistan, including employment and anti-discrimination laws.</li>
          <li>You must not charge candidates any fee, and you must not post listings for multi-level marketing, unlawful work, or anything misleading.</li>
          <li>Use candidate information only to assess and contact people about your own vacancies. Do not sell it, share it with third parties, or use it for marketing.</li>
          <li>Job listings stay open for {JOB_LISTING_DAYS} days unless you close them sooner.</li>
        </ul>
      </LegalSection>

      <LegalSection id="conduct" title="6. Things you must not do">
        <ul>
          <li>Post false, offensive, defamatory, discriminatory or unlawful content.</li>
          <li>Impersonate another person or organization.</li>
          <li>Collect other users&apos; information by scraping or automated means.</li>
          <li>Try to access accounts or data that are not yours, probe or disrupt the service, or get around security measures or plan limits.</li>
          <li>Send spam or use the platform for anything other than genuine job seeking and hiring.</li>
        </ul>
      </LegalSection>

      <LegalSection id="plans" title="7. Plans and payments">
        <ul>
          <li><strong>Free plans:</strong> candidates can submit up to {FREE_APPLICATION_LIMIT} job applications per calendar month (Pakistan Standard Time). Employers can have {FREE_ACTIVE_JOB_LIMIT} active job listing at a time.</li>
          <li><strong>{PLANS.CANDIDATE_PRO.name}:</strong> {formatPKR(PLANS.CANDIDATE_PRO.price)} for {MEMBERSHIP_DAYS} days. {PLANS.CANDIDATE_PRO.benefits.join(". ")}.</li>
          <li><strong>{PLANS.EMPLOYER_GROWTH.name}:</strong> {formatPKR(PLANS.EMPLOYER_GROWTH.price)} for {MEMBERSHIP_DAYS} days. {PLANS.EMPLOYER_GROWTH.benefits.join(". ")}.</li>
          <li>Payment is made outside this website, through the channel our team provides. No payment is taken on the website. A membership starts only after an administrator confirms your payment, and it lasts {MEMBERSHIP_DAYS} days.</li>
          <li>Memberships do not renew automatically. Benefits end when the period ends unless you request a renewal and it is approved.</li>
          <li>If we cannot confirm a payment, we will reject the request and no membership is activated. Once a membership has been activated it is not refundable, except where the law requires otherwise.</li>
          <li>We may change prices or plan features for future periods. Changes do not affect a membership period that has already started.</li>
        </ul>
      </LegalSection>

      <LegalSection id="content" title="8. Your content">
        <p>
          You keep ownership of the content you submit, such as your profile, cover letters and job listings. You give us permission to store, display and share it as needed to run the service, for example showing a job listing to the public or delivering an application to an employer. You confirm that you have the right to submit it.
        </p>
      </LegalSection>

      <LegalSection id="moderation" title="9. Suspension and removal">
        <p>
          We may remove content, or suspend or close an account, if we reasonably believe these terms have been broken, the law requires it, or it is needed to protect other users or the service. Where practical we will tell you why.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" title="10. No guarantees">
        <p>
          The service is provided &quot;as is&quot;. We do not verify every listing, employer or candidate, and we are not responsible for the accuracy of what users post, the conduct of any user, or the outcome of any application or hiring decision. Use your own judgement before sharing information, attending interviews, or entering into any agreement.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="11. Limit of liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential losses, lost profits, or lost opportunities arising from your use of the service. Our total liability to you for any claim is limited to the amount you paid us for membership in the three months before the claim arose. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Governing law">
        <p>These terms are governed by the laws of the Islamic Republic of Pakistan, and the courts of Pakistan have jurisdiction over any dispute.</p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes to these terms">
        <p>We may update these terms as the service changes. The date at the top shows the latest version. If you keep using the service after a change takes effect, you accept the updated terms.</p>
      </LegalSection>

      <LegalSection id="contact" title="14. Contact and reporting">
        <ContactLine purpose="To ask a question about these terms, or to report a suspicious listing, a user, or a security problem" />
      </LegalSection>
    </LegalPage>
  );
}
