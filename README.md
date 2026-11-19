# Connect HR

Connect HR is a Pakistan-focused jobs and hiring marketplace. Candidates build career profiles, search and apply for jobs, and track their applications. Employers publish jobs, review applicants, and (on Employer Growth) search candidates who have chosen to share their profiles. Administrators approve memberships and manage accounts.

## Product overview

| Role | What they can do |
| --- | --- |
| Guest | Browse and search open jobs, view plans, register. |
| Candidate | Maintain a profile (headline, summary, skills, experience, visibility), apply with an optional cover letter, track application status. |
| Employer | Maintain a company profile, create, edit and close jobs, review applicants and set their status, search public candidates (Growth only). |
| Administrator | View platform statistics, approve or reject membership requests, view membership history, suspend or reactivate accounts. Actions are audit-logged. |

### Plans

| Plan | Price | Limits |
| --- | --- | --- |
| Candidate Free | — | 3 applications per calendar month (Pakistan time) |
| Candidate Pro | PKR 1,499 / 30 days | Unlimited applications while active |
| Employer Free | — | 1 active job |
| Employer Growth | PKR 9,999 / 30 days | Up to 5 active jobs and candidate search |

There is no payment gateway. A member requests a plan (optionally with an external payment reference). An administrator confirms the payment outside the app and approves the request, which activates the plan for 30 days. Benefits stop automatically at the end of the period. Members can request a renewal in the last 7 days.

## Technology

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Prisma 6 · PostgreSQL · Tailwind CSS 4. Tests use Node's built-in test runner with `tsx` against a real PostgreSQL test database.

### Code layout

| Path | Purpose |
| --- | --- |
| `app/` | Routes. Mutations live in `app/actions/*` as thin server-action wrappers. |
| `lib/services/` | Business rules (jobs, applications, memberships, accounts, profiles, candidate search). Every rule is enforced here on the server. |
| `lib/entitlements.ts` | The single source of truth for plan limits and membership validity. |
| `lib/auth.ts` | Signed session cookie and `requireUser` route guard. |
| `prisma/` | Schema, migrations, and seed. |
| `tests/` | Integration tests for the services. |
| `scripts/e2e-smoke.mjs` | End-to-end HTTP test against a running server. |
| `legacy/` | Retired TaskMarket code, kept for reference and not reachable. |

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
npm test            # integration tests (60) against an isolated *_test database
npm run typecheck
npm run lint
```

`npm test` creates `connecthr_test` (or uses `TEST_DATABASE_URL`), applies the migrations to it, and runs `tests/*.test.ts`. It refuses to run against a database whose name does not contain `test`.

End-to-end check (82 HTTP-level checks, including real server-action calls):

```bash
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

## Documentation

- [Implementation audit](docs/CONNECT_HR_IMPLEMENTATION_AUDIT.md): the initial assessment
- [Development checklist](docs/CONNECT_HR_DEVELOPMENT_CHECKLIST.md)
- [Implementation report](docs/CONNECT_HR_IMPLEMENTATION_REPORT.md): what changed, test results, and known limitations
- [Deployment guide](docs/CONNECT_HR_DEPLOYMENT.md)

## Legacy TaskMarket data

The app began as a services marketplace (TaskMarket). Its tables (tasks, quotes, escrow, payouts, messages, ratings, FBR records) are **kept** so no data is lost. Its pages redirect to the jobs area. Its server actions aren't imported anywhere, so they aren't callable. Its API endpoints return `410 Gone` unless `LEGACY_TASKMARKET_ENABLED=true`. Legacy users choose a candidate or employer role the next time they sign in.
