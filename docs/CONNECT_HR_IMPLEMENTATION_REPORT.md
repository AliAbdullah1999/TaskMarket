# Connect HR — Implementation Report

**Date:** 2026-11-17
**Baseline:** commit `c2bb0e3`, plus the uncommitted UI refresh that was already in the working tree. That refresh is preserved.
**State:** all work is uncommitted in the working tree, ready for review.

## 1. Summary

The existing app already had a sound base: a signed-cookie session, scrypt password hashing, Prisma ownership filters, and Serializable transactions on the two main limits. The audit found it incomplete in the areas that matter for launch:

- No way to edit a job
- The monthly limit used the server's time zone instead of Pakistan time
- Employer dashboard counts were wrong past 20 rows
- Members couldn't give a payment reference, and approvals weren't attributed to an admin
- No migration history
- Pricing advertised benefits that don't exist
- Signed-in users had no navigation at tablet widths

All of these are fixed. Business rules now live in one tested service layer. All 30 MVP acceptance criteria are met except responsive layout, which is code-reviewed but not visually checked (see §8).

## 2. Existing functionality preserved

- Custom session auth (`lib/auth.ts`), scrypt hashing (`lib/password.ts`) and the HMAC cookie format. Existing sessions stay valid.
- The visual design system (`components/ui.tsx`, the working-tree UI refresh, the home page).
- Every existing route and server-action name, so links and forms keep working.
- Legacy account migration (TaskMarket users choose candidate or employer).
- All database records. The dev database had 12 users, 2 subscriptions, 5 tasks, 2 employer profiles, 6 tasker profiles and 4 messages before migrating, and the same counts after.

## 3. New functionality

| Area | What was added | Key files |
|---|---|---|
| Business rules | A service layer with every authorisation, ownership and limit check | `lib/services/*.ts`, `lib/entitlements.ts`, `lib/transactions.ts`, `lib/time.ts` |
| Jobs | Edit job; manage-jobs list with filters and pagination; close confirmation; expiry shown everywhere; company-name search; paginated listings | `app/jobs/[id]/edit`, `app/jobs/manage`, `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`, `components/job-form.tsx` |
| Applications | Role-aware `/applications` page: candidates track status and updates, employers review across jobs with job and status filters | `app/applications/page.tsx`, `components/applicant-list.tsx` |
| Account | Account settings (name, city, phone, password change) | `app/account`, `app/actions/account.ts`, `lib/services/accounts.ts` |
| Membership | Optional member payment reference; cancel a pending request; 7-day renewal window that doesn't lose paid time; `REJECTED` status with reason; reviewer recorded; member history on `/pricing` | `lib/services/memberships.ts`, `app/pricing/page.tsx` |
| Candidate search | Case-insensitive skill filter, minimum-experience filter, pagination, a public profile page | `lib/services/candidates.ts`, `app/candidates/*` |
| Admin | Six live statistics; membership history with filters; account search and inspection; audit log of approvals, rejections, suspensions and reactivations | `app/admin/*`, `AdminAuditLog` model |
| UX | Shared navigation config; navigation at every width; consistent status labels; error boundary; welcome notices | `lib/navigation.ts`, `components/site-navigation.tsx`, `components/workspace-sidebar.tsx`, `app/error.tsx` |
| Testing | Integration test harness on an isolated database, plus an end-to-end HTTP script | `scripts/test.mjs`, `tests/*.test.ts`, `scripts/e2e-smoke.mjs` |

## 4. Bugs fixed

| Bug | Impact | Fix |
|---|---|---|
| The monthly application limit used the server's local time zone | On a UTC host, the limit reset at 05:00 PKT on the 1st instead of midnight | `pktMonthStart()` is now used in one place (`lib/entitlements.ts`) |
| Employer "Applications" and "Needs review" tiles counted only the latest 20 rows | Wrong numbers on busy accounts | Real `count()` queries |
| The candidate "Applications" tile counted only the latest 30 rows | Wrong total | Real `count()` |
| A future-dated membership counted as active | A renewal could have granted benefits early | `currentPeriodStart <= now` added to the entitlement check |
| Membership requests had a check-then-insert race | Duplicate pending requests | Serializable transaction with retry |
| `setUserStatus` with an unknown id threw P2025 | 500 error | Validated, with a friendly message |
| Admins could suspend other admins | Lock-out risk | Blocked |
| Skill search was case-sensitive | "excel" didn't find "Excel" | `skillsNormalized` column plus a backfill |
| Login `next` accepted `/\evil.com` | Open redirect | `safeNext()` blocks it |
| Unknown emails returned faster than wrong passwords on login | Account enumeration | Dummy hash comparison |
| Unexpected errors in actions surfaced the default Next error page | Poor UX | `runAction` logs the error and returns a generic message; `app/error.tsx` added |
| Signed-in users between 768 and 1023 px had no navigation | Couldn't navigate on tablets | The menu button now shows below `lg` for signed-in users |
| Pricing advertised "priority placement", and search sorted Pro candidates first with a "Featured" badge | An unimplemented benefit was advertised | Removed |
| Pricing listed "Unlimited applications to your vacancies" for Growth | An invented benefit | Removed. The plan copy now comes from the `PLANS` catalogue. |
| An expired job showed "Closed" | Misleading | Shows "Expired" |
| The README told users to create `.env.local`, but the Prisma CLI reads `.env` | `prisma:push` failed on a fresh setup | Documentation corrected |
| Found during testing: a root `loading.tsx` made auth redirects and 404s return HTTP 200 (client-side redirects) | Wrong status codes for protected pages | Removed |

## 5. Database changes

The new migration `prisma/migrations/20261117000000_connect_hr_mvp` is additive only:

- `SubscriptionStatus` gains `REJECTED`.
- `Subscription` gains `requestedReference`, `reviewedById` (FK to User, `SET NULL`) and `reviewNote`.
- `CandidateProfile` gains `skillsNormalized TEXT[] DEFAULT '{}'`, backfilled from `skills`.
- New `AdminAuditLog` table (FK to User, `RESTRICT`, so audit history can't be cascade-deleted).
- New indexes: `CandidateProfile(isPublic, updatedAt)` and `Subscription(status, createdAt)`.

I also created a baseline migration, `prisma/migrations/0_init`, generated from the schema at `c2bb0e3`. Databases built with `db push` are baselined with `prisma migrate resolve --applied 0_init`.

Where the migrations have been applied:

- `connecthr_test`: on every `npm test` run, from empty.
- The local dev database `TaskMaster`: I checked first that it had no drift from the baseline, then baselined it and deployed. Row counts were unchanged.

## 6. Security improvements

- **Every rule is enforced on the server.** Role, ownership and plan checks run inside the services, and the user id always comes from the session. Integration tests attack each service directly: cross-employer edits, closes and status changes; candidate self-approval; non-admin suspension; wrong-plan requests; admin signup.
- **Concurrency-safe limits.** Application, active-job and membership-request limits run in Serializable transactions with retry. Tests fire parallel requests and confirm exactly the allowed number succeed.
- **Privacy.**
  - Candidate search selects an explicit whitelist (name, city, profile fields).
  - Private and suspended profiles are excluded, and a direct URL to one returns 404.
  - Applicant email is visible only to the employer who owns the job, and the apply form says so.
  - Phone numbers are never shown to other users.
- **Membership integrity.** Only `REQUESTED` rows can be reviewed, so rejected or cancelled requests can never activate. Approval requires a confirmed reference. Pending requests unlock nothing.
- **Legacy surface removed.** Legacy admin actions moved to `legacy/taskmarket/` (unimported). The build's server-action manifest lists only the 17 active actions. Legacy API endpoints return `410` unless explicitly re-enabled.
- **Auth hardening.** Open-redirect fix, timing equalisation, input length caps (a password over 128 characters is rejected before scrypt runs).
- **CSRF and XSS.** Server Actions' Origin check plus SameSite=Lax cookies. React escaping, no `dangerouslySetInnerHTML`. Company website links use `rel="noopener noreferrer nofollow"`.

## 7. Testing results

All results below come from runs on 2026-11-17 against the final code.

| Suite | Type | Result |
|---|---|---|
| `npm test` (17 suites, 60 tests: auth, applications, jobs, memberships/admin, candidate search/profiles) | Automated integration, real PostgreSQL | **60 / 60 pass** |
| `scripts/e2e-smoke.mjs` against `next start` (production build) | Automated end-to-end over HTTP, real server-action calls | **82 / 82 pass** |
| `npm run typecheck` | Static | Pass |
| `npm run lint` | Static | Pass |
| `npm run build` | Build | Pass (28 routes) |
| Responsive layout and visual check | Manual | **Not performed** |

### Integration tests (`tests/`)

Each test sets up its own data, calls the service, and asserts on the result and on database state.

| Area | What is tested | Result |
|---|---|---|
| Registration | Hashed password, private profile by default, case-insensitive duplicate email, admin and legacy roles rejected, field validation | Pass |
| Login | Valid login; identical message for wrong password and unknown email; suspended account blocked; off-site `next` URLs rejected | Pass |
| Account settings | Own-account updates only; password change requires the current password; anonymous calls rejected | Pass |
| PKT boundaries | 00:30 PKT on 1 Nov counts as November; 23:59 PKT on 31 Oct counts as October | Pass |
| Applications | Apply; duplicates (sequential and concurrent); closed, expired and missing jobs; non-candidates rejected | Pass |
| Monthly limit | 3 per month; parallel bypass blocked; previous PKT month excluded; withdrawn applications still count; Pro unlimited; expired, pending, future-dated or wrong-plan memberships don't lift the limit | Pass |
| Applicant review | Owner moves the pipeline forward; final decisions locked; other employers and candidates blocked; invalid statuses rejected | Pass |
| Jobs | Create with 30-day expiry; role check; validation including salary range; Free 1 and Growth 5 limits; expired Growth falls back to Free; parallel bypass blocked; edit preserves status and expiry; cross-employer edit and close blocked; close once | Pass |
| Memberships | Requests grant nothing until approved; plan must match role; conflicts (including concurrent) blocked; renewal window; cancel own request only; malformed references rejected | Pass |
| Admin review | 30-day activation with reviewer and audit entry; reference required; non-admins (including self-approval) blocked; rejected or cancelled requests can't activate; renewal starts at the current period's end | Pass |
| Expiry | Benefits end at the period end; lapsed memberships marked EXPIRED | Pass |
| Admin accounts | Suspend and reactivate with audit trail; non-admins blocked; admins protected; self, missing and invalid targets rejected | Pass |
| Candidate search | Growth-only access (pending doesn't count); public and active only; no email, phone or user id in results; combined filters; pagination | Pass |
| Profiles | Visibility toggle; skills de-duplicated and normalised; role-scoped saves; https website rule; company name synced | Pass |

### End-to-end checks (`scripts/e2e-smoke.mjs`)

The 82 checks cover:

- Candidate and employer signup, with a session cookie set
- Duplicate email and admin-signup attempts rejected
- Invalid credentials rejected; the off-site `next` URL ignored
- Route guards for guests, candidates, employers and admin
- Profile save, and the cross-role save attempt
- The Free employer limit, then the full Growth journey: request, conflicting request, pending request with search still locked, non-admin approval attempt, admin approval, 30-day period with reviewer, double-approval rejected
- 5 Growth jobs, then the 6th rejected
- Skill search, with no email or phone in the HTML; private profiles hidden from search, and their direct URL returns 404
- Three applications, a duplicate, and the 4th rejected
- Employer apply attempt rejected; candidate application history
- Cross-employer status change, edit, 404 on edit page, and close all blocked
- Owner shortlist, edit and close; the candidate sees the new status
- Closed jobs reject applications and drop out of listings; combined filters
- Suspension: existing session stops working, login blocked, reactivation restores access; audit log entries written
- Admin figures match database counts; admin pages load
- After forcing expiry: candidate search locked, Free limit back in force, status marked EXPIRED
- 11 role pages render; no unimplemented benefits on pricing
- Legacy redirects and 410 endpoints; logout clears the cookie

## 8. Known limitations

1. **Responsive layout hasn't been checked visually.** The layouts use responsive utilities and the tablet navigation gap is fixed in code, but I haven't looked at them in a browser at phone, tablet and desktop widths. Do this before launch.
2. **No rate limiting** on login or signup. Use a proxy or WAF (see the deployment guide).
3. **No email verification and no password reset by email.** Both need an email provider, which isn't in scope. Users can change their password while signed in, and admins can suspend accounts.
4. **Email can't be changed** by the user. It's the sign-in identity.
5. **Forms need JavaScript.** `ActionForm` submits through a transition to keep the user's input when validation fails, so there's no progressive enhancement for these forms.
6. **No route-level loading skeletons**, because they break HTTP status codes for redirects and 404s (see §4). Form buttons show pending states.
7. **Growth downgrade:** when Growth expires, jobs that are already open stay open until they're closed or expire. Only new postings are blocked.
8. **Skill filter matches whole skills,** case-insensitively ("excel" matches "Excel", but "exc" doesn't). Keyword search does partial matching on headline, summary and name.
9. **The `WITHDRAWN` application status exists but there's no withdraw action.** Withdrawal isn't in the MVP. Withdrawn applications still count toward the monthly limit by design.
10. **Payment instructions** come from the `PAYMENT_INSTRUCTIONS` environment variable rather than an admin setting.
11. **Prisma logs the duplicate-email constraint error** at error level before the app handles it. This is cosmetic log noise.
12. Prisma warns that `package.json#prisma` is deprecated ahead of Prisma 7. It's harmless for now.

## 9. Remaining work and recommendations

- Visual QA at 375, 768 and 1280 px, then fix any issues found.
- Add login and signup rate limiting at the edge.
- Add a password reset by email once an email provider is chosen.
- Future cleanup (separate PR, after confirming legacy data can be archived): remove `legacy/`, `app/actions/tasks.ts`, `app/actions/profile.ts`, `app/tasks/**`, `app/taskers/**`, `app/compliance`, `app/api/*`, the legacy components (`task-card`, `tasker-card`, `message-thread`, `rating-form`), `lib/escrow.ts`, `lib/fbr-report.ts`, `lib/compliance.ts`, `lib/address-crypto.ts`, and finally the legacy Prisma models, through a migration with a data export first.
- Rename the seeded demo admin email (`admin@careermarket.pk`) if demo data is used for public demos.
- Commit the work on a feature branch and open a PR.
