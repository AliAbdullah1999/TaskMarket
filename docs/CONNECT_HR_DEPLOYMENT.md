# Connect HR — Deployment Guide

## 1. Environment requirements

| Requirement | Notes |
|---|---|
| Node.js | 20 LTS or newer |
| PostgreSQL | 14 or newer. A managed service (Neon, Supabase, RDS, Azure) is fine. |
| Hosting | Any Node host that can run `next start` (VPS, Render, Railway, Fly, Azure App Service), or Vercel. Every page renders dynamically, so static export is not supported. |
| HTTPS | Required. The session cookie is `Secure` in production. |

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Prefer a pooled URL on serverless hosts. |
| `SESSION_SECRET` | Yes | 32+ random bytes (hex). The app refuses to start in production without it. Rotating it signs everyone out. |
| `APP_URL` | Yes | Public address of the site without a trailing slash, for example `https://connecthr.pk`. Used for links in emails, the sitemap and `robots.txt`, so it must also be set at build time. On Vercel the production domain is used if it is unset. |
| `SMTP_USER`, `SMTP_PASS` | One email option is required | Send through a mailbox. For Gmail: the address and a Google app password (needs 2-Step Verification). About 500 emails a day; suitable for demos and early use. `SMTP_HOST` and `SMTP_PORT` default to Gmail. |
| `RESEND_API_KEY`, `EMAIL_FROM` | One email option is required | Send through Resend from a verified domain, for example `Connect HR <no-reply@connecthr.pk>`. Recommended for a public launch. If SMTP is also set, SMTP is used. |
| `CRON_SECRET` | Yes | Random secret for `/api/cron/daily`. Vercel Cron sends it automatically. |
| `NEXT_PUBLIC_APP_NAME` | No | Display name. Defaults to "Connect HR". |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Yes | Contact address shown on the Terms and Privacy pages and in `security.txt`. |
| `NEXT_PUBLIC_LEGAL_ENTITY` | Yes | Registered business name shown on the legal pages. |
| `PAYMENT_INSTRUCTIONS` | Recommended | Shown on the membership page (bank account, JazzCash or Easypaisa details). |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env` or `.env.local`. Both are git-ignored.

## 2. Database migration

**Back up the production database before migrating.**

### Database created with `prisma db push` (no `_prisma_migrations` table)

1. Check that the live schema matches the baseline. This should print "empty migration":

   ```bash
   git show c2bb0e3:prisma/schema.prisma > /tmp/schema.baseline.prisma
   npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel /tmp/schema.baseline.prisma --script
   ```

   If it prints SQL instead, stop and reconcile the differences before continuing.

2. Mark the baseline as applied. This records history only and doesn't change the schema:

   ```bash
   npx prisma migrate resolve --applied 0_init
   ```

3. Apply the Connect HR migration:

   ```bash
   npx prisma migrate deploy
   ```

### New, empty database

```bash
npx prisma migrate deploy
```

### What the MVP migration changes

All changes are additive:

- Adds the `REJECTED` value to the `SubscriptionStatus` enum.
- Adds nullable columns `requestedReference`, `reviewedById` and `reviewNote` to `Subscription`.
- Adds `CandidateProfile.skillsNormalized` (default `{}`) and backfills it from `skills`.
- Creates the `AdminAuditLog` table.
- Adds indexes on `CandidateProfile(isPublic, updatedAt)` and `Subscription(status, createdAt)`.

### What the security migration changes

`20261120000000_security_hardening` is also additive: `User.sessionVersion` and `User.termsAcceptedAt`, a `RateLimit` table, and Row Level Security enabled on every table. The app must connect as the role that owns the tables (the role that ran the migrations), because other roles are denied by RLS.

### What the MVP completion migration changes

`20261123000000_mvp_completion` is additive: `User.emailVerifiedAt`, `Job.removedReason`, `Subscription.renewalReminderSentAt`, and the `AuthToken` and `JobInvitation` tables (both with Row Level Security). It marks every **existing** account as email-confirmed so current members are not locked out of applying or publishing; only accounts created afterwards must confirm.

**Apply this migration before deploying the new code.** The new code reads the new columns on every request, so deploying first would break every page until the migration runs.

### What the TaskMarket removal migration changes

`20261123010000_remove_taskmarket` is **destructive**: it drops the eight tables of the earlier services marketplace (`Task`, `Quote`, `EscrowTransaction`, `Payout`, `Message`, `Rating`, `FBRReportRecord`, `TaskerProfile`) with all their rows, and the enum types only they used. User accounts are kept. Take a backup first if any of that data, such as payout or FBR records, must be retained.

### Never do this in production

`prisma db push --force-reset`, `prisma migrate reset`, or `npm run prisma:seed -- --reset`. The last one deletes all data.

## 3. Production build

```bash
npm ci                 # also runs prisma generate (postinstall)
npm run typecheck
npm run lint
npm test               # needs a reachable *test* database; skip on hosts without one
npm run build
npm start              # or: npx next start -p $PORT
```

On Vercel, set the environment variables in the project settings. The default build command (`next build`) works. Run `prisma migrate deploy` as a release step, or from CI before promoting the deployment.

## 4. First administrator

Signup can't create admin accounts. To create the first administrator:

1. Register normally (for example as a candidate) with the admin's email address.
2. Promote the account directly in the database:

   ```sql
   UPDATE "User" SET "userType" = 'ADMIN' WHERE email = 'ops@yourcompany.pk';
   ```

3. Sign out and back in.

Don't run the demo seed in production. It creates accounts with the known password `password123`, and it refuses to run when `NODE_ENV=production`.

## 5. Production verification

After each deployment, check:

| Check | Expected |
|---|---|
| `GET /` | 200 with real job and member counts |
| `GET /jobs` | Lists only open, unexpired jobs. Search and filters work. |
| `GET /dashboard` signed out | Redirects to `/login` |
| Register a test candidate | Lands on `/profile?welcome=1`, sees the "Confirm your email address" banner, and receives the confirmation email |
| Open the emailed confirmation link | "Email confirmed"; the banner disappears |
| Request a reset from `/forgot-password` | Email arrives; the link sets a new password once |
| `GET /api/health` | `200 {"status":"ok"}` |
| `GET /api/cron/daily` without the secret | `401` |
| `GET /sitemap.xml` | Lists open jobs with the production domain |
| Candidate opens `/admin` | Redirected to `/dashboard` |
| Admin opens `/admin` | Six statistics, request queue and audit log |
| Response headers on login | `Set-Cookie: tm_session=…; HttpOnly; Secure; SameSite=Lax` |

For a full regression run against a staging copy, use `scripts/e2e-smoke.mjs` (see the README). It must point at a database whose name contains `test`.

## 6. Operations notes

- **Daily job.** `vercel.json` schedules `GET /api/cron/daily` at 01:00 UTC (06:00 in Pakistan). On other hosts, call it once a day with `Authorization: Bearer $CRON_SECRET`. It emails renewal reminders, marks lapsed memberships `EXPIRED`, and deletes expired rate-limit counters and links. It is safe to run more than once.
- **Membership expiry** does not depend on the daily job. Entitlements are checked by date on every request.
- **Email.** Sending failures are logged as `[email] …` and never fail the user's action. With Resend, check its dashboard for bounces and set up SPF and DKIM for the sending domain. With Gmail, watch the daily sending limit and move to Resend before a public launch.
- **Moderation.** Suspending an employer hides all of their listings immediately. Individual listings are removed from `/admin/jobs`; removal is permanent and the employer is emailed the reason.
- **Uptime.** Point a monitor at `/api/health`.
- **Job expiry** is also date-based. Expired jobs disappear from listings and stop accepting applications automatically.
- **Suspension** takes effect on the user's next request. Sessions are checked against account status every time.
- **Logs:** unexpected server-action errors are logged as `[server action] unexpected error`. Users only see a generic message.
- **Rate limiting** for sign-in, sign-up, password reset, confirmation emails and invitations is built in (PostgreSQL-backed). Per-address limits use the first `X-Forwarded-For` entry, which is only trustworthy behind a proxy that sets it (Vercel does). On a bare VPS, put Nginx or Cloudflare in front and have it overwrite that header.
