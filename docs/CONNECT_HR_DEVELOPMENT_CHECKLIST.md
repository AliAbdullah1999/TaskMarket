# Connect HR — Development Checklist

**Last updated:** 2026-11-17

How each item was verified:

- **IT**: automated integration test (`npm test`, real PostgreSQL)
- **E2E**: automated HTTP test against the production build (`scripts/e2e-smoke.mjs`, including real server-action calls)
- **CR**: code review only

## MVP acceptance criteria

| # | Criterion | Status | Verified by |
|---|---|---|---|
| 1 | Candidate registration and login work | ✅ | IT, E2E |
| 2 | Employer registration and login work | ✅ | IT, E2E |
| 3 | Role-based access works | ✅ | E2E (admin, search and job-form guards), IT (service role checks) |
| 4 | Candidate profiles work | ✅ | IT, E2E |
| 5 | Candidate visibility settings work | ✅ | IT, E2E |
| 6 | Job discovery works | ✅ | E2E |
| 7 | Job search and filters work (combined) | ✅ | E2E |
| 8 | Candidates can apply for jobs | ✅ | IT, E2E |
| 9 | Duplicate applications are prevented (including concurrent requests) | ✅ | IT, E2E |
| 10 | Free candidate limit: 3 per PKT calendar month (including parallel requests) | ✅ | IT, E2E |
| 11 | Candidate Pro gives unlimited applications | ✅ | IT |
| 12 | Employers can manage company profiles | ✅ | IT |
| 13 | Employers can create, edit and close jobs | ✅ | IT, E2E |
| 14 | Free employer limit (1 active job) | ✅ | IT, E2E |
| 15 | Growth employer limit (5 active jobs) | ✅ | IT, E2E |
| 16 | Employers can review applications | ✅ | E2E |
| 17 | Application status management (owner only, final decisions locked) | ✅ | IT, E2E |
| 18 | Candidate search for Growth members only | ✅ | IT, E2E |
| 19 | Private profiles stay private (search and direct URL) | ✅ | IT, E2E |
| 20 | Membership requests (conflicts prevented, optional reference, cancel) | ✅ | IT, E2E |
| 21 | Admin membership approval and rejection | ✅ | IT, E2E |
| 22 | Membership expiry (30 days, benefits removed, marked EXPIRED) | ✅ | IT, E2E |
| 23 | Admin account management (suspend, reactivate, inspect) | ✅ | IT, E2E |
| 24 | Server-side authorisation enforced | ✅ | IT, E2E |
| 25 | Database relationships consistent; migrations apply cleanly | ✅ | `migrate deploy` on the test DB on every run, plus the dev DB (row counts unchanged) |
| 26 | Core user journeys pass testing | ✅ | E2E (82/82) |
| 27 | Responsive layouts work | ⚠️ Partial | CR only. The tablet navigation gap is fixed in code, but I haven't checked the layouts visually in a browser. |
| 28 | No critical runtime errors remain | ✅ | E2E server log is clean (only the expected Prisma log for the duplicate-email test) |
| 29 | Production build succeeds | ✅ | `npm run build` |
| 30 | Documentation complete | ✅ | README plus the four docs in `/docs` |

## Phase checklist

### Phase 1: Audit
- [x] Repository, schema, routes, actions and environment reviewed
- [x] `docs/CONNECT_HR_IMPLEMENTATION_AUDIT.md`

### Phase 2: Foundation
- [x] Baseline migration `0_init` plus additive `20261117000000_connect_hr_mvp`
- [x] Business rules moved to `lib/services/*` and `lib/entitlements.ts`
- [x] Serializable transactions with retry for every check-then-write limit
- [x] Generic error handling in actions (`runAction`) and `app/error.tsx`
- [x] Login hardening: open-redirect fix, timing equalisation, input length limits

### Phase 3: Candidate
- [x] PKT calendar-month application limit
- [x] Paginated job search including company name
- [x] `/applications` with status filter and update activity
- [x] Account settings (name, city, phone, password)
- [x] Removed the "priority placement" claim and the Pro-first search sort

### Phase 4: Employer
- [x] Job edit (`/jobs/[id]/edit`)
- [x] `/jobs/manage` with status filter and pagination
- [x] Close-job confirmation dialog
- [x] Cross-job applications view with job and status filters
- [x] Dashboard metrics from `count()` queries
- [x] Applicant email shared with the owning employer only, disclosed on the apply form

### Phase 5: Membership
- [x] Optional member payment reference; cancel pending request
- [x] `REJECTED` status, reviewer, review note, audit log
- [x] Renewal window (7 days) with no lost paid time
- [x] Lazy `EXPIRED` marking, plus member history on `/pricing`

### Phase 6: Candidate search
- [x] Keyword, skill (case-insensitive), city and minimum-experience filters
- [x] Database pagination
- [x] `/candidates/[id]` public profile view (Growth only, 404 for private profiles)
- [x] Explicit safe field selection (no email or phone)

### Phase 7: Admin
- [x] Six real statistics, including pending requests and active memberships
- [x] `/admin/memberships` history with filters
- [x] `/admin/accounts` with search, role and status filters, and account details
- [x] Admins can't be suspended from the console; missing targets handled

### Phase 8: UI and UX
- [x] Single navigation config shared by header and sidebar
- [x] Signed-in navigation available at every width
- [x] Consistent status labels (Applied, Under review, Shortlisted, Hired, Not selected)
- [x] Empty, success and error states on new screens; confirmations for destructive actions
- [ ] Visual QA in a browser at phone, tablet and desktop widths (not done)
- [ ] Route loading skeletons. I removed them deliberately: a root `loading.tsx` turned auth redirects and 404s into HTTP 200 responses.

### Phase 9: Testing
- [x] 60 integration tests, all passing
- [x] 82 end-to-end checks, all passing
- [x] Typecheck, lint and build all pass

### Phase 10: Final review
- [x] Legacy routes, actions and endpoints isolated
- [x] Environment documented (`.env.example`, deployment guide)
- [x] Limitations documented in the implementation report
