import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage, LegalSection } from "@/components/legal";
import { APP_NAME, LEGAL_ENTITY, MINIMUM_AGE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${APP_NAME} collects, uses, shares and protects your personal information.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains what personal information ${LEGAL_ENTITY} ("${APP_NAME}", "we", "us") collects when you use this website, why we collect it, who can see it, and the choices you have.`}
    >
      <LegalSection id="collect" title="1. Information we collect">
        <p>We collect only what the service needs to work.</p>
        <ul>
          <li><strong>Account details:</strong> your full name, email address, city, and an optional Pakistani mobile number. Your password is stored only as a salted one-way hash; we cannot read it.</li>
          <li><strong>Candidate profile:</strong> your professional headline, summary, skills, years of experience, and whether you chose to make your profile visible to employers.</li>
          <li><strong>Employer profile:</strong> your company name, industry, website and description.</li>
          <li><strong>Jobs and applications:</strong> the job listings employers publish, and the applications and cover letters candidates submit, with their status.</li>
          <li><strong>Invitations:</strong> when an employer invites a candidate to apply for a job, we record the invitation and any message the employer wrote.</li>
          <li><strong>Membership records:</strong> the plan you requested, its dates, and any payment reference you or our team entered. We do not collect or store card numbers or bank account details on this website.</li>
          <li><strong>Technical information:</strong> a sign-in cookie, and short-lived security counters used to limit repeated sign-in attempts. These counters store a one-way hash, not your email or network address. Our hosting provider may keep standard server logs.</li>
        </ul>
      </LegalSection>

      <LegalSection id="use" title="2. How we use your information">
        <ul>
          <li>To create and secure your account, to confirm that your email address is yours, and to sign you in.</li>
          <li>To send you service emails: confirming your email, resetting your password, updates on your applications, new applications to your jobs, invitations to apply, and membership notices. We do not send marketing emails.</li>
          <li>To show job listings, deliver applications to employers, and show you the status of your applications.</li>
          <li>To let employers with an active Employer Growth membership find candidate profiles that candidates chose to make visible.</li>
          <li>To review and activate membership requests.</li>
          <li>To prevent abuse, investigate misuse, and enforce our <Link href="/terms" className="font-semibold text-emerald-800 hover:underline">Terms of Service</Link>.</li>
          <li>To meet legal obligations.</li>
        </ul>
        <p>We do not use your information for advertising, and we do not sell it.</p>
      </LegalSection>

      <LegalSection id="sharing" title="3. Who can see your information">
        <ul>
          <li><strong>The public</strong> can see job listings and the hiring company&apos;s name, industry, description and website.</li>
          <li><strong>An employer you apply to</strong> can see your name, email address, city, career profile and cover letter for that application. They cannot see your mobile number.</li>
          <li><strong>Employers with an active Employer Growth membership</strong> can see your name, city, headline, summary, skills and experience, but only if you turned on &quot;Show my profile in employer search&quot;. Your email address and mobile number are never shown in search. These employers can send you an invitation to apply for one of their jobs; we deliver it by email on their behalf, and they do not receive your contact details unless you apply. Your profile is private by default.</li>
          <li><strong>Our administrators</strong> can see account details and membership records to operate the service. Administrative actions are logged.</li>
          <li><strong>Service providers</strong> that host the website and database, and that deliver our emails, process data on our behalf.</li>
          <li><strong>Authorities</strong>, where we are required to by applicable law in Pakistan.</li>
        </ul>
      </LegalSection>

      <LegalSection id="cookies" title="4. Cookies">
        <p>
          We use one essential cookie, which keeps you signed in for up to 14 days. It is marked HttpOnly, so scripts cannot read it, and it is sent only to this website. We do not use advertising or analytics cookies, so there is no cookie banner to accept. If you block this cookie you can still browse jobs, but you cannot sign in.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="5. Your choices and rights">
        <ul>
          <li><strong>See and correct your data:</strong> edit your profile and account details at any time from your account.</li>
          <li><strong>Control your visibility:</strong> turn employer search visibility on or off from your profile.</li>
          <li><strong>Download your data:</strong> get a copy of everything we hold about you from Account settings.</li>
          <li><strong>Delete your account:</strong> permanently delete your account and its data from Account settings.</li>
          <li><strong>Sign out everywhere:</strong> end all sessions on all devices from Account settings.</li>
        </ul>
        <ContactLine purpose="If you need help with any of these, or want to raise a privacy concern" />
      </LegalSection>

      <LegalSection id="retention" title="6. How long we keep information">
        <p>
          We keep your information while your account exists. When you delete your account, your profile, applications, invitations, job listings and membership records are removed from the live database. Copies may remain in backups for a limited time, and we may keep records we are legally required to keep. Security counters expire automatically within a day, and password-reset and email-confirmation links within two days.
        </p>
      </LegalSection>

      <LegalSection id="security" title="7. How we protect information">
        <ul>
          <li>Passwords are stored as salted hashes, never in readable form.</li>
          <li>Access to data is checked on our servers for every request, based on your role and what you own.</li>
          <li>Repeated failed sign-in attempts are temporarily blocked.</li>
          <li>The website is served over encrypted connections (HTTPS) with modern browser security protections.</li>
        </ul>
        <p>No online service can promise perfect security. Use a strong, unique password, and tell us promptly if you believe your account has been accessed without permission.</p>
      </LegalSection>

      <LegalSection id="children" title="8. Age requirement">
        <p>The service is for people aged {MINIMUM_AGE} or over. We do not knowingly collect information from anyone younger.</p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes to this policy">
        <p>We may update this policy as the service changes. The date at the top shows the latest version. If a change significantly affects how we use your information, we will make that clear on the website.</p>
      </LegalSection>

      <LegalSection id="contact" title="10. Contact us">
        <ContactLine purpose="For any question about this policy or your personal information" />
      </LegalSection>
    </LegalPage>
  );
}
