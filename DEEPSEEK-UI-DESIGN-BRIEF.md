# CareerMarket PK — Application Overview and UI Design Brief

Use this document as the product and screen specification when asking DeepSeek to design the application. It reflects the current product and codebase, including access rules and limitations. Design every active screen listed below as one coherent product; do not invent functionality that is not described here.

## Copy-ready design request

> Design a complete, polished, responsive web application for **CareerMarket PK**, a Pakistan-focused jobs and recruitment marketplace. Create high-fidelity desktop and mobile designs for every active route and state listed in this brief. The product serves guests, job candidates, employers, and administrators. Make the experience feel mature, elegant, welcoming, trustworthy, and distinctly professional—not like a generic admin template. Use an editorial jobs-and-careers aesthetic, restrained forest-green accents, warm off-white and soft sage surfaces, deep ink typography, generous whitespace, refined borders, subtle shadows, clear status indicators, and highly readable forms and tables. Keep all screens consistent through a shared design system, navigation, footer, buttons, cards, fields, badges, empty states, and responsive behavior.
>
> Preserve the product’s existing information architecture, roles, data, routes, and behavior in this document. Design separate candidate and employer dashboards and profile forms. On signup, the company-name field must appear and be required only when “I’m hiring” is selected; candidates must not be asked for a company name. Make important states visible: empty and populated listings, no search matches, job closed/expired/already applied, plan request pending/active, employer Growth paywall, profile private/public, form validation/submission feedback, and admin confirmation/rejection. Clearly disclose that plan prices are proposed and payments are handled outside the app; do not design an actual checkout or imply that a plan request activates access immediately.
>
> Deliver: (1) sitemap and role-based navigation, (2) a high-fidelity design for each screen/state below, (3) desktop and mobile layouts, (4) reusable component and token/style guide, and (5) annotated interaction/validation notes. Use realistic sample content and Pakistani cities/currency. Do not add resumes/uploads, messaging, social login, automated payments, job alerts, or other features unless they are explicitly described here. Treat retired local-task/tasker routes as redirects, not as product screens.

## Product summary

**CareerMarket PK** connects job seekers and hiring teams in Pakistan.

- **Candidates** create a career profile, browse jobs, apply with an optional cover letter, and follow application outcomes.
- **Employers** create an organization profile, post jobs, review applicants, and update application statuses.
- **Administrators** monitor platform activity, manage accounts, and manually review membership requests after externally verifying payment.
- **Guests** can browse jobs, see job details, and create an account. Candidate profile search is an employer-only, paid-plan feature.

The product has moved from a local-services marketplace to recruiting. Some older task marketplace database models and actions remain for data compatibility, but the old customer/tasker pages redirect and are not active destinations to design.

## Design direction

The current visual direction is warm, calm, and professional:

- **Brand:** CareerMarket PK; compact “C” brand mark.
- **Palette:** forest/emerald green as the primary action color; warm off-white background; white surfaces; muted sage highlights; deep slate/ink for text. Use blue sparingly for employer or information states, amber for pending/warnings, and red for destructive/error states.
- **Typography:** polished sans serif, strong readable page headings, restrained uppercase eyebrow labels, clear hierarchy, comfortable body line-height.
- **Surfaces:** softly rounded cards and fields, subtle neutral borders and low-contrast shadows. Prioritize clarity and whitespace over decoration.
- **Components:** sticky responsive header, role-aware navigation, consistent footer, page heading, job card, candidate result card, stats, status badge, input/select/textarea, alert/feedback, empty state, confirmation/action control.
- **Responsive behavior:** design mobile-first. Collapse multi-column grids and dashboard sidebars cleanly. Keep tables/forms readable and actions reachable without horizontal overflow.
- **Accessibility:** semantic headings/forms/nav, visible keyboard focus, clear labels and errors, adequate contrast, status not conveyed by color alone, reduced-motion support.
- **Tone:** confident, humane, direct, inclusive, and locally relevant. Use PKR and Pakistan city names. Avoid unverified trust claims, fabricated testimonials, or fabricated business metrics.

## Roles and navigation

### Guest

- Browse jobs, view job details, view public pricing.
- Header actions: Log in, Join now.
- Job detail prompts a guest to create a candidate account to apply.
- Signup has role selector: “I’m looking for work” or “I’m hiring”.

### Candidate

- Find jobs, plans, My applications, dashboard, profile, log out.
- Can apply to open jobs using an optional cover letter.
- Can see if they already applied and application status.
- Can maintain profile and explicitly opt into employer search; candidate profiles default private.

### Employer

- Find jobs, plans, Find candidates, Applicants/dashboard, Post a job, profile, log out.
- Can post and close own jobs, review applicants, and update statuses.
- Candidate search is available only with an active Employer Growth plan; otherwise show a helpful paywall with a plans CTA.

### Administrator

- Admin console and dashboard, plus account navigation/log out.
- The current active admin page focuses on platform metrics, membership requests, and newest accounts. Keep actions explicit and safe.

## Sitemap and screen inventory

Design each active route. Screens with role-dependent variants should be represented as distinct states within the same design.

### 1. `/` — Public homepage

- Marketing hero for careers and hiring across Pakistan.
- Primary CTA: Explore jobs. Secondary CTA changes for employers: Post a job if already signed in as employer, otherwise Hire talent.
- Platform metrics card: open jobs, hiring organizations, candidate profiles, nationwide location coverage. Metrics must display actual app data, not fabricated numbers.
- Recent opportunities section with up to six job cards; provide a friendly first-listing empty state if no jobs exist.
- Browse-by-industry links for Administration, Customer Service, Design, Education, Engineering, Finance, Healthcare, Human Resources, Information Technology, Marketing, Sales, Other.
- Candidate/employer “how it works” steps and action cards.
- Final CTA section supporting candidates and employers.
- Header and footer.

### 2. `/jobs` — Job search and discovery

- Heading and count of open jobs.
- Search by title, description, or category keywords; filters for category and city; clear filters.
- Job result cards show category, title, company/employer, employment type, city/workplace, salary if provided, posted date, applicant count where available.
- Empty state when no matching jobs.
- Cities: Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Remote.
- Categories are listed in the homepage section above.
- Results are currently limited to the latest 30 jobs; design pagination only if marked as a future concept, not an existing control.

### 3. `/jobs/[id]` — Job detail and application

- Job status (accepting applications or closed), posted date, title, employer/company, category, city, workplace type, employment type, monthly salary when disclosed, applicant count.
- Main content: role description and optional requirements.
- Employer panel with company name, industry, and company introduction when present.
- Candidate state: optional cover-letter form, submit action, already-applied confirmation, or closed-job message.
- Guest state: candidate signup CTA.
- Employer-owner state: close listing action and applicant list, including candidate name, headline/city, profile summary/skills where available, optional cover letter, application date/status, and status controls.
- Statuses: Submitted, Reviewing, Shortlisted, Rejected, Hired.
- Non-owner employers do not get owner controls.

### 4. `/signup` — Role-aware account creation

- Role selection cards: “I’m looking for work” and “I’m hiring”.
- Fields common to both: full name, email, mobile number (optional; clarify that it is never shown to others), city, password.
- **Company name is visible and required only for the employer role. Never ask candidates to supply a company name.**
- City select uses the supported Pakistan city list above.
- Password guidance: at least 8 characters including a letter and a number.
- Show inline validation, pending state, server error, successful account creation/redirect.
- Candidate account creation leads to candidate profile setup; employer goes to dashboard.

### 5. `/login` — Sign in

- Email and password fields, clear validation and error feedback, welcome-back messaging, link to signup.
- Suspended-account error state; successful login routes to dashboard or requested safe destination.

### 6. `/dashboard` — Role-specific workspace

This is two different dashboard experiences and must be designed separately.

**Candidate dashboard**

- Greeting and Explore jobs CTA.
- Metrics: total applications, monthly applications, profile completion/visibility, plan.
- Recent applications list with job, company, city, applied date, and status.
- Empty state linking to job discovery.
- Candidate profile completion/visibility card.
- Membership summary, remaining free applications, plan CTA, and pending membership state.

**Employer dashboard**

- Greeting and Post a job CTA.
- Metrics: active listings, recent applications, needs-review count, plan.
- Job listing activity list with status and application volume; empty state.
- Recent applicant list with candidate/headline/job/date and review links.
- Organization profile completion card.
- Plan/active job slot summary and hiring shortcuts to post jobs and search candidates.

### 7. `/profile` — Role-specific profile editor

**Candidate**

- Professional headline (max 120 characters), professional summary (max 2,000), comma-separated skills (up to 20, max 40 characters each), years of experience (0–60).
- Explicit “Show my profile in employer search” privacy toggle, off by default. Explain that only employers with an active Growth plan can see opted-in profiles.
- Save state and success/error feedback.

**Employer**

- Company name, industry, HTTPS website, company description.
- Save state and success/error feedback.

### 8. `/jobs/new` — Employer job creation

- Employer-only form; unauthorized roles return to dashboard.
- Job title (8–120 characters), category, city, employment type, workplace type, optional minimum and maximum monthly salary (PKR), role description (50–10,000 characters), optional requirements (up to 5,000).
- Employment types: Full-time, Part-time, Contract, Internship, Temporary.
- Workplace types: On-site, Hybrid, Remote.
- Helpful content guidance and validation; publishing state and errors.
- Free employers can have one active listing; active Growth employers can have up to five. Show limit-related messaging and a plans CTA when appropriate.
- Newly posted jobs expire after 30 days.

### 9. `/candidates` — Employer candidate search

- Employer-only, paid access gate. Without active Employer Growth, show the product benefits, price/plan context, and View employer plan CTA.
- With access: search opted-in public profiles by candidate name, headline, or summary and filter by city.
- Candidate result cards show name, headline, city, years of experience, summary, skills, and Featured badge for active Candidate Pro members.
- Empty state explains that candidates control their profile visibility.
- Do not show private candidate profiles.

### 10. `/pricing` — Membership plans

- Guests see both plans; candidates see Candidate Pro; employers see Employer Growth; unsupported signed-in roles get an explanatory state.
- Candidate Pro: proposed PKR 1,499/month; unlimited job applications, eligible for priority placement in employer search, profile visibility remains under candidate control.
- Employer Growth: proposed PKR 9,999/month; up to five active job listings, access to opted-in candidate profiles, unlimited applications to vacancies.
- Free allowances: candidates can submit up to three applications per calendar month; employers can have one active listing.
- Membership request states: request plan, request pending admin review, active until date, or account role not eligible.
- **Critical disclosure:** proposed prices only; payment processing is not integrated. Requesting a plan does not charge the user or unlock paid limits. Admin manually confirms external payment and activates the membership. Do not design checkout, card entry, automatic billing, or instant activation.

### 11. `/admin` — Admin console

- Admin-only screen.
- Overview metrics: candidates, employers, open jobs, applications.
- Membership request queue with user, email, account role, plan, request date.
- Approve flow requires an external payment reference; reject flow; show pending/reviewed/success/error states.
- Newest accounts list with name, role, email, city, join date, status, suspend/reactivate action.
- Keep high-impact actions clearly labelled and confirmation-oriented. Do not imply that the current page has a full moderation, analytics, or dispute-management UI.

### 12. Legacy-account migration state (shown at `/dashboard` for older account roles)

- Some existing accounts still have the old CUSTOMER, BUSINESS, or TASKER role.
- Explain that the platform moved from local services to recruiting and that their prior records remain preserved.
- Two clear choices: continue as candidate or continue as employer.
- Candidate conversion creates a private career profile; employer conversion creates an organization profile.
- Do not make this the default new-user journey.

### 13. Shared and supporting screens/states

- Shared authenticated/guest header, role-aware navigation, footer.
- Global database-not-configured setup notice (technical setup state, not a normal visitor page).
- Global not-found page with return-home CTA.
- Form pending, success, server error, field validation, empty result, access-denied/role redirect, expired listing, and plan limit states.
- Legacy routes `/tasks`, `/tasks/new`, `/tasks/[id]`, `/tasks/[id]/checkout`, `/taskers`, `/taskers/[id]`, and `/compliance` redirect into current recruiting routes; do not create standalone new product screens for these.

## Core user journeys

### Candidate journey

Homepage or job search → job details → candidate signup (role preset to candidate) → candidate profile setup → browse/apply with optional cover letter → candidate dashboard tracks status → optionally make profile public → employer search visibility requires active Growth plan on employer side.

### Employer journey

Homepage or signup (role preset to employer) → create account with company name → complete company profile → publish job → review applications on job detail/dashboard → update candidate status → optionally request Employer Growth → admin manually reviews external payment before access activates → search only public candidate profiles.

### Admin journey

Admin login → console metrics → review pending membership requests after external payment verification → approve with payment reference or reject → manage/suspend/reactivate user accounts.

### Guest journey

Homepage → search/filter jobs → view public job detail → signup/login to apply. Candidate search and dashboards require authentication and correct role; candidate search also requires active employer membership.

## Data and behavior boundaries

- All listed cities are Pakistani locations and Remote.
- Salary values are monthly PKR, and both endpoints are optional; salary may be undisclosed.
- Candidates may apply only once to each job. An application is unique per candidate/job pair.
- Candidate free application limit is three per calendar month; Candidate Pro removes this cap.
- Employer free active job limit is one; Employer Growth active job limit is five.
- Candidate public visibility is opt-in and defaults off.
- Only employers with an active Employer Growth subscription can search public candidate profiles.
- Plan request is not a payment. Admin approval is manual after an external payment reference is verified.
- Job status is open/closed/archived; listings have a 30-day expiry.
- Application status progression includes submitted, reviewing, shortlisted, rejected, and hired (withdrawn exists in the data model).
- Do not create invented user-generated testimonials, logos, exact job counts, companies, or trust badges; use clearly marked sample content for mockups.
- Do not confuse “candidate’s employer” with the candidate: candidates provide their own name and career details, not company details.

## What to ask DeepSeek to return

1. A route-by-route sitemap organized by guest, candidate, employer, and admin access.
2. High-fidelity desktop and mobile screens for all 13 screen groups above, including role variants and key empty/pending/error states.
3. A reusable component catalog and design tokens (color, type, spacing, radius, shadow, controls, badges, tables/cards).
4. Interaction notes for signup role switching, search/filter, application submission, employer review actions, privacy toggle, and membership request/approval.
5. Realistic sample data and polished final UI copy using PKR and Pakistan locations.
6. An explicit list of assumptions or suggested future enhancements kept separate from the existing product scope.
