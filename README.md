# Connect HR

Connect HR is a Pakistan-focused jobs and hiring marketplace. Candidates build career profiles, search and apply for jobs, and track their applications. Employers publish jobs, review applicants, and (on Employer Growth) search candidates who have chosen to share their profiles and invite them to apply. Administrators approve memberships, manage accounts and moderate job listings. The app sends transactional email for email confirmation, password reset and activity notifications.

## Product overview

| Role | What they can do |
| --- | --- |
| Guest | Browse and search open jobs, view plans, register, reset a forgotten password by email. |
| Candidate | Maintain a profile (headline, summary, skills, experience, visibility), apply with an optional cover letter, track application status, receive invitations from employers. Must confirm their email before applying. |
| Employer | Maintain a company profile, create, edit and close jobs, review applicants and set their status, search public candidates and invite them to apply (Growth only). Must confirm their email before publishing. |
| Administrator | View platform statistics, approve or reject membership requests, view membership history, suspend or reactivate accounts, remove job listings with a reason. Actions are audit-logged. |

### Plans

| Plan | Price | Limits |
| --- | --- | --- |
| Candidate Free | — | 3 applications per calendar month (Pakistan time) |
| Candidate Pro | PKR 1,499 / 30 days | Unlimited applications while active |
| Employer Free | — | 1 active job |
| Employer Growth | PKR 9,999 / 30 days | Up to 5 active jobs, candidate search and invitations to apply |

There is no payment gateway. A member requests a plan (optionally with an external payment reference). An administrator confirms the payment outside the app and approves the request, which activates the plan for 30 days. Benefits stop automatically at the end of the period. Members can request a renewal in the last 7 days, and are emailed a reminder when that window opens.

### Email

Email is sent by `lib/email.ts` in one of two ways, plus `APP_URL` for the links:

- **SMTP mailbox, including Gmail** (simplest, good for demos): set `SMTP_USER` to the Gmail address and `SMTP_PASS` to a Google [app password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification; the normal account password does not work). Gmail allows roughly 500 emails a day and messages come from that Gmail address. For another mailbox also set `SMTP_HOST` and `SMTP_PORT`.
- **Resend** (for a real launch on your own domain): set `RESEND_API_KEY` and `EMAIL_FROM`.

Without either, development prints each email (including confirmation and reset links) to the server console, and production sends nothing.

| Email | Sent to | When |
| --- | --- | --- |
| Confirm your email | New member | At sign-up, and on "Resend email" |
| Reset your password | Member | On request from `/forgot-password` (link valid 1 hour, single use) |
| New application | Employer | A candidate applies |
| Application update | Candidate | The employer changes the application status |
| Invitation to apply | Candidate | A Growth employer invites them to a job |
| Membership approved / not approved | Member | An administrator reviews the request |
| Membership ends soon | Member | 7 days before the period ends (daily job) |
| Listing removed | Employer | An administrator removes a job |

## Technology

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Prisma 6 · PostgreSQL · Tailwind CSS 4. Tests use Node's built-in test runner with `tsx` against a real PostgreSQL test database.

### Code layout

| Path | Purpose |
| --- | --- |
| `app/` | Routes. Mutations live in `app/actions/*` as thin server-action wrappers. |
| `lib/services/` | Business rules (jobs, applications, memberships, accounts, recovery, profiles, candidate search, invitations, moderation, maintenance). Every rule is enforced here on the server. |
| `lib/email.ts`, `lib/notifications.ts` | Email transport and the notification emails. |
| `lib/entitlements.ts` | The single source of truth for plan limits and membership validity. |
| `lib/auth.ts` | Signed session cookie and `requireUser` route guard. |
| `prisma/` | Schema, migrations, and seed. |
| `tests/` | Integration tests for the services. |
| `scripts/e2e-smoke.mjs` | End-to-end HTTP test against a running server. |

## Prerequisites

- Node.js 20+ (developed on Node 24)
- PostgreSQL 14+

## Installation

```bash
npm install
cp .env.example .env      # then set DATABASE_URL (and SESSION_SECRET for production)
```

The Prisma CLI reads `.env`. Next.js reads both `.env` and `.env.local`.

## Database setup

The schema is managed with **Prisma migrations** (`prisma/migrations`).

**New, empty database:**

```bash
npm run prisma:migrate      # prisma migrate deploy
npm run prisma:seed         # optional demo data
```

**Existing database previously set up with `prisma db push`.** Mark the baseline as applied once, then deploy:

```bash
npx prisma migrate resolve --applied 0_init
npm run prisma:migrate
```

The `20261117000000_connect_hr_mvp` migration is additive only: a new enum value, nullable columns, a new table, indexes, and a backfill of `skillsNormalized`. No data is removed.

> `npm run prisma:push` is still available for throwaway local databases, but don't use it on shared or production databases. `npm run prisma:seed -- --reset` **deletes all data** and is for local demo databases only.

## Local development

```bash
npm run dev     # http://localhost:3000
```

Demo accounts from the seed (password `password123`):

| Role | Email |
| --- | --- |
| Admin | `admin@careermarket.pk` |
| Candidate | `amina@example.com` |
| Employer | `hiring@northstar.example`, `careers@orbital.example` |

## Testing

```bash
npm test            # integration tests (100) against an isolated *_test database
npm run typecheck
npm run lint
```

`npm test` creates `connecthr_test` (or uses `TEST_DATABASE_URL`), applies the migrations to it, and runs `tests/*.test.ts`. It refuses to run against a database whose name does not contain `test`.

End-to-end check (145 HTTP-level checks, including real server-action calls). Setting `NEXT_DIST_DIR` builds into a separate folder so a running dev server is not disturbed; set it for all four commands:

```bash
export NEXT_DIST_DIR=.next-verify
npm run build
DATABASE_URL=<test db url> npx tsx prisma/seed.ts --reset
DATABASE_URL=<test db url> npx next start -p 3100 &
DATABASE_URL=<test db url> node scripts/e2e-smoke.mjs
```

## Production build

```bash
npm run build
npm start
```

See [docs/CONNECT_HR_DEPLOYMENT.md](docs/CONNECT_HR_DEPLOYMENT.md) for deployment steps and post-deploy verification.

Operational endpoints: `GET /api/health` (database check for uptime monitors), `GET /api/cron/daily` (daily maintenance, needs `Authorization: Bearer $CRON_SECRET`; scheduled in `vercel.json`), and `/sitemap.xml`. CI (`.github/workflows/ci.yml`) runs lint, type check, tests and a build on every push and pull request.

## Documentation

- [Implementation audit](docs/CONNECT_HR_IMPLEMENTATION_AUDIT.md): the initial assessment
- [Development checklist](docs/CONNECT_HR_DEVELOPMENT_CHECKLIST.md)
- [Implementation report](docs/CONNECT_HR_IMPLEMENTATION_REPORT.md): what changed, test results, and known limitations
- [Deployment guide](docs/CONNECT_HR_DEPLOYMENT.md)
- [Security overview](docs/CONNECT_HR_SECURITY.md): standards comparison, what is implemented, and what is still needed

## Earlier TaskMarket version

The app began as a services marketplace (TaskMarket). That code and its tables (tasks, quotes, escrow, payouts, messages, ratings, FBR records, tasker profiles) were removed on 23 November 2026 by the `20261123010000_remove_taskmarket` migration, which **deletes that data**. Old `/tasks` and `/taskers` addresses redirect to the jobs area. Accounts created back then still exist; their owners choose a candidate or employer role the next time they sign in.
