# Connect HR — Implementation Audit (Phase 1)

**Audit date:** 2026-11-17
**Scope:** the full repository at commit `c2bb0e3` plus the uncommitted working-tree changes present at the start of the audit (UI refresh of 20 files and three new components).
**Method:** I read every route, server action, library module, component and the Prisma schema; ran `npm run typecheck` and `npm run lint` (both clean); and compared the local PostgreSQL database with the schema (`prisma migrate diff` reported no drift). I did not run the app in a browser during the audit. Statuses below come from code review unless stated otherwise.

Status key: **COMPLETE** (implemented and correct on review) · **PARTIAL** · **BROKEN** · **MISSING** · **NEEDS VERIFICATION**.

---

## 1. Repository overview

| Area | Findings |
|---|---|
| Stack | Next.js 16.3.5 (App Router, Server Actions), React 19.2, TypeScript (strict), Prisma 6.13, PostgreSQL, Tailwind 4. No test framework. |
| Auth | Custom HMAC-signed session cookie (`lib/auth.ts`), scrypt password hashing (`lib/password.ts`). Suspended or banned users are rejected on every request. |
| Data access | Server components query Prisma directly. Mutations go through `"use server"` actions that return `ActionState` via `runAction`. |
| Migrations | **None.** The schema has been applied with `prisma db push`. There is no migration history. |
| Env | `DATABASE_URL`, `SESSION_SECRET` (required in production), `ADDRESS_ENCRYPTION_KEY` and `CRON_SECRET` (legacy only), `NEXT_PUBLIC_APP_NAME`. The Prisma CLI reads `.env`, but the README tells users to create `.env.local`, so `npm run prisma:push` fails with an empty `.env`. |
| Branding | The default app name is "CareerMarket PK". The product is Connect HR. |
| Local DB | `TaskMaster` holds 12 users (mostly legacy CUSTOMER/TASKER/BUSINESS), 2 employer profiles, 2 subscriptions, 5 legacy tasks and 0 jobs. It must be preserved. |
| Deployment config | No deployment config is checked in. `next.config.ts` is empty. |

## 2. Feature audit

### 2.1 Authentication and accounts

| Feature | Files | Status | Problems | Required work | Priority |
|---|---|---|---|---|---|
| Candidate and employer registration | `app/actions/auth.ts`, `components/signup-form.tsx` | PARTIAL | The role is restricted to CANDIDATE/EMPLOYER on the server, and duplicate emails are handled through P2002. Name, email and password have no maximum length (a very long password costs scrypt time). | Add length limits. | P1 |
| Login and logout | `app/actions/auth.ts` | PARTIAL | `next` redirect blocks `//` but not `/\` (browsers treat that as protocol-relative, so it's an open redirect). A missing user returns without hashing, which leaks via timing whether an email exists. There is no rate limiting. | Harden the redirect, add a dummy hash, and document rate limiting as a limitation. | P1 |
| Session management | `lib/auth.ts` | COMPLETE | Signed, httpOnly, SameSite=Lax cookie, secure in production, 14-day expiry. Production refuses to boot without `SESSION_SECRET`. | — | — |
| Protected routes | `requireUser` | COMPLETE | The redirect to `/login` loses the original path (minor). | — | P3 |
| Account settings (name, city, phone, password) | `app/actions/profile.ts` (legacy, not imported) | MISSING | Candidates and employers cannot change their name, city, phone or password. The only account action is a legacy TaskMarket one, and no page imports it. | Add an `/account` page and actions. | P1 |
| Role-change protection | `transitionLegacyAccount` | COMPLETE | Only legacy CUSTOMER/TASKER/BUSINESS accounts can choose a role, and only CANDIDATE or EMPLOYER. No action can grant ADMIN. | — | — |
| Error handling in actions | `lib/action-state.ts` | PARTIAL | Unexpected errors (for example, the database being down) reach the default Next error screen. There is no `error.tsx`. | Return a generic message, log server-side, add `app/error.tsx`. | P1 |

### 2.2 Candidate module

| Feature | Files | Status | Problems | Required work | Priority |
|---|---|---|---|---|---|
| Candidate profile (headline, summary, skills, experience, visibility) | `app/profile/page.tsx`, `app/actions/profiles.ts` | COMPLETE | Ownership comes from the session, never from the form. The profile starts private. Full name and city can't be edited (see Account settings). | Link to account settings. | P2 |
| Visibility control | same | COMPLETE | Search filters `isPublic: true` and active users only. | Add an index on `isPublic`. | P3 |
| Job discovery (browse, keyword, category, city) | `app/jobs/page.tsx`, `components/job-card.tsx` | PARTIAL | Filters combine correctly (AND), and only OPEN, non-expired jobs are listed. Results are hard-capped at 30 with **no pagination**. Keyword search ignores the company name. | Add pagination and company-name search. | P1 |
| Job detail | `app/jobs/[id]/page.tsx` | PARTIAL | An expired job shows "Closed". | Show "Expired". | P2 |
| Apply with an optional cover letter | `app/actions/jobs.ts#applyToJob` | PARTIAL | Checks open/expired status and duplicates (unique index plus P2002) in a Serializable transaction. **The monthly limit uses the server's local time zone** (`new Date(y, m, 1)`), not PKT. WITHDRAWN applications are excluded from the count. | Use a PKT month boundary and centralise the check. | **P0** |
| Monthly limit (Free 3 / Pro unlimited) | `applyToJob`, `jobs/[id]/page.tsx`, `dashboard/page.tsx` | PARTIAL | The same check is duplicated in three places, each with the time-zone bug. A Pro membership whose start date is in the future would count as active. | Move it into one entitlement module. | **P0** |
| Application history and status | `app/dashboard/page.tsx` | PARTIAL | Shows the latest 30 only. The "Applications" tile counts the fetched rows, not the real total. Status labels are raw enum text. There is no dedicated page. | Add an `/applications` page with pagination, a real count, labels and last-updated activity. | P1 |
| "Priority placement" benefit | `app/pricing/page.tsx`, `app/candidates/page.tsx` | BROKEN (scope) | Pricing advertises "Eligible for priority placement", and candidate search sorts Pro users first with a "Featured" badge. The requirements say Pro includes unlimited applications **only**. | Remove the claim, the sort and the badge. | P1 |

### 2.3 Employer module

| Feature | Files | Status | Problems | Required work | Priority |
|---|---|---|---|---|---|
| Company profile | `app/profile/page.tsx`, `updateEmployerProfile` | COMPLETE | Upsert keyed on the session user. Website must be https. | — | — |
| Create job | `createJob` | PARTIAL | Thorough validation, a Serializable limit check, and a 30-day `expiresAt`. The limit logic is duplicated in `jobs/new/page.tsx`. | Centralise the entitlement and share validation with edit. | P1 |
| Edit job | — | **MISSING** | — | Add `/jobs/[id]/edit` and an `updateJob` action restricted to the owner. | **P0** |
| Manage jobs list | dashboard (latest 20) | PARTIAL | No dedicated page, pagination or status filter. | Add `/jobs/manage`. | P1 |
| Close job | `closeJob` | PARTIAL | The `updateMany` is scoped to the owner (correct). There is no confirmation for this destructive action. | Add a confirmation dialog. | P2 |
| Active-job limits (Free 1 / Growth 5) | `createJob` | COMPLETE (logic) | Enforced on the server in a Serializable transaction. A future-dated Growth membership would count as active. | Use the shared entitlement. | P1 |
| Applicant review and status updates | `jobs/[id]/page.tsx`, `updateApplicationStatus` | PARTIAL | Ownership is enforced through `employerId`. HIRED and REJECTED are terminal. There is no cross-job applications view, and the employer has **no way to contact a hired or shortlisted candidate**. | Add an `/applications` page and share the applicant's email with the owning employer only, disclosed when the candidate applies. | P1 |
| Employer dashboard metrics | `app/dashboard/page.tsx` | **BROKEN** | "Applications" and "Needs review" are computed from only the latest 20 rows, so they're wrong once there are more than 20 applications. The navigation lacks Manage Jobs, Applications and Account. | Use real `count()` queries and add the navigation. | **P0** |

### 2.4 Candidate search (Employer Growth)

| Feature | Files | Status | Problems | Required work | Priority |
|---|---|---|---|---|---|
| Growth gate | `app/candidates/page.tsx` | COMPLETE | Checked on the server per request. | Use the shared entitlement. | P1 |
| Visibility and privacy | same | COMPLETE | Only `fullName`, `city` and profile fields are selected. No email or phone. | — | — |
| Keyword, city and skills filters | same | PARTIAL | Keyword covers headline, summary and name, but **not skills**. There is no experience filter. | Add skills matching and a minimum-experience filter. | P1 |
| Pagination | same | MISSING | Hard limit of 50, sorted in memory. | Paginate in the database. | P1 |
| Public profile view | — | MISSING | — | Add a `/candidates/[id]` page (Growth only, public profiles only). | P2 |

### 2.5 Membership and monetisation

| Feature | Files | Status | Problems | Required work | Priority |
|---|---|---|---|---|---|
| Plan catalogue and prices | `lib/constants.ts`, `app/pricing/page.tsx` | PARTIAL | Prices match the requirements (PKR 1,499 / 9,999) but are labelled "proposed". Employer Growth lists an invented benefit ("Unlimited applications to your vacancies"). | Correct the copy. | P1 |
| Request a plan | `requestSubscription` | PARTIAL | Plan is tied to role, so a user can't request the wrong plan. The conflict check is not atomic (two concurrent requests can both be created). **The user can't submit an external payment reference**, can't cancel a pending request, and can't renew before expiry. | Use a Serializable transaction, add an optional reference, a cancel action and a 7-day renewal window. | **P0** |
| Admin approve or reject | `reviewSubscription` | PARTIAL | Approval requires a reference and is guarded by `status: REQUESTED`. **The reviewing admin isn't recorded.** Rejection reuses `CANCELLED`, so a rejection can't be told apart from a cancellation. There is no audit log. | Add `reviewedById`, a `REJECTED` status, a review note and an `AdminAuditLog`. | **P0** |
| Expiry (30 days) | entitlement checks | PARTIAL | Benefits stop at `currentPeriodEnd` (correct), but the status stays `ACTIVE` forever, so history and stats are misleading. | Mark lapsed memberships `EXPIRED` lazily and count only date-valid ones. | P1 |
| Pending requests don't unlock features | all checks require ACTIVE | COMPLETE | — | — | — |
| Membership history | — | MISSING | — | Add an admin history page and the user's own history on pricing. | P1 |

### 2.6 Administration

| Feature | Files | Status | Problems | Required work | Priority |
|---|---|---|---|---|---|
| Dashboard statistics | `app/admin/page.tsx` | PARTIAL | Candidates, employers, open jobs and applications all come from real queries. **Pending requests and active memberships are not shown.** | Add both. | P1 |
| Account management | `setUserStatus` | PARTIAL | Shows the newest 20 accounts only, with no search or pagination. A missing `userId` throws P2025, producing a 500. An admin can suspend other admins (an admin can't suspend themselves). | Add an `/admin/accounts` page with search, filter and pagination, plus target validation, admin protection and an audit entry. | P1 |
| Authorisation | `requireAdmin`, `requireUser(["ADMIN"])` | COMPLETE | Every admin action checks `userType === "ADMIN"` from the session. | — | — |
| Audit trail | — | MISSING | — | Add an `AdminAuditLog` model and write entries for approve, reject, suspend and reactivate. | P2 |

### 2.7 Legacy TaskMarket functionality

| Item | Location | Status | Notes and plan |
|---|---|---|---|
| Legacy pages `/tasks*`, `/taskers*`, `/compliance` | `app/tasks/**`, `app/taskers/**`, `app/compliance` | COMPLETE (isolated) | All redirect to `/jobs` or `/`. |
| Legacy server actions | `app/actions/tasks.ts`, `app/actions/profile.ts` | Isolated | No page imports them, so Next doesn't register them as callable actions. Kept for reference. |
| Legacy admin actions | `reviewNtn`, `resolveDispute`, `markPayoutPaid` in `app/actions/admin.ts` | **Exposed** | They're registered because the admin page imports `admin.ts`. They're admin-only, but they run obsolete escrow workflows. Move them to an unimported legacy module. |
| Legacy API routes | `app/api/cron/auto-release`, `app/api/admin/fbr-report` | **Exposed** | Escrow auto-release (needs `CRON_SECRET`) and FBR CSV export (admin only) are still live. Disable them unless `LEGACY_TASKMARKET_ENABLED=true`. |
| Legacy components | `task-card`, `tasker-card`, `message-thread`, `rating-form` | Unused | Safe to remove in a future cleanup. |
| Legacy libraries | `lib/escrow.ts`, `lib/fbr-report.ts`, `lib/compliance.ts`, `lib/address-crypto.ts` | Used only by legacy code | Keep for now. |
| Legacy models | TaskerProfile, Task, Quote, EscrowTransaction, Payout, Message, Rating, FBRReportRecord, plus `UserType` CUSTOMER/TASKER/BUSINESS | Keep | They hold existing data, and User has relations to all of them. No deletion. |
| Legacy account migration | `components/legacy-account-migration.tsx` | COMPLETE | Legacy users pick candidate or employer on the dashboard. Data is preserved. |

### 2.8 Database and Prisma

| Check | Finding |
|---|---|
| Duplicate applications | `@@unique([jobId, candidateId])` prevents them. |
| Ownership | `Job.employerId`, plus `JobApplication.employerId` (denormalised, set by the server from the job). |
| Cascades | Deleting a user cascades to profiles, jobs and applications. Admins can only suspend, never delete. |
| Indexes | Jobs (status/city/category/createdAt, employerId/status), applications (candidate/createdAt, employer/status/createdAt) and subscriptions (userId/status/end) are covered. Missing: `CandidateProfile.isPublic`, and `Subscription(status, createdAt)` for the admin queue. |
| Enums | `ApplicationStatus` already covers Submitted, Reviewing, Shortlisted, Hired and Rejected (plus WITHDRAWN). `SubscriptionStatus` lacks `REJECTED`. |
| Migrations | None. I need to create a baseline (`0_init`) plus an additive MVP migration, and baseline existing databases with `prisma migrate resolve`. |

### 2.9 Security summary

| Area | Finding |
|---|---|
| Password hashing | scrypt with a 16-byte salt and timing-safe compare. Good. |
| SQL injection | Prisma parameterises every query. No raw SQL in the active code. |
| XSS | React escapes output. No `dangerouslySetInnerHTML`. |
| CSRF | Server Actions check the Origin header. Cookies are SameSite=Lax. |
| Client-trusted values | Role on signup is whitelisted, `employerId` and `candidateId` always come from the session, and plan comes from role. Good. |
| Open redirect | `/\` bypass in login `next` (fix). |
| User enumeration | Timing difference on login (fix). |
| Internal errors | Unhandled errors can surface the default error page. In production no stack trace is shown, but the experience is poor (fix). |
| Rate limiting | None (document; needs infrastructure). |

### 2.10 UI and UX

- There's a consistent design language (emerald and slate, rounded cards, shared `ui.tsx` components). The current working-tree refresh is preserved.
- **Navigation gap:** signed-in users between 768 and 1023 px have no navigation. The desktop header nav is hidden for signed-in users, the sidebar only shows from 1024 px, and the hamburger is hidden from 768 px.
- Navigation links are defined twice (header and sidebar), and the copies already differ.
- There's no `loading.tsx`, so navigations show no pending state.
- Empty states exist for jobs, applications and candidates. Success and error feedback exists through `ActionForm`.

### 2.11 Testing

There are no tests and no test framework. I'll add a minimal setup: Node's built-in test runner with `tsx`, running against an isolated `*_test` PostgreSQL database that the migrations create. That way the tests also verify the migrations.

---

## 3. Development checklist

The live checklist is in [`CONNECT_HR_DEVELOPMENT_CHECKLIST.md`](./CONNECT_HR_DEVELOPMENT_CHECKLIST.md).

## 4. Decisions recorded during the audit

1. **Business time zone:** monthly application limits use the calendar month in Asia/Karachi (UTC+5, no DST).
2. **Applicant contact:** when a candidate applies, their email is shared with **the employer who owns that job only**. The apply form discloses this. Phone numbers are never shared. Without this, employers can't act on Shortlisted or Hired outcomes, because messaging is out of scope.
3. **Rejected memberships** get a new `REJECTED` status. `CANCELLED` now means the user withdrew their own request.
4. **Renewal:** a user can request the same plan again in the last 7 days of an active membership. If approved, the new period starts when the current one ends.
5. **Plan downgrade:** when Growth expires, existing open jobs stay open until they're closed or expire. The Free limit applies to new postings.
6. **Withdrawn applications** still count toward the monthly limit, so the limit can't be reset by withdrawing. There's currently no withdraw action at all.
