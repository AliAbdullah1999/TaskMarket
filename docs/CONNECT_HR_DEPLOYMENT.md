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
| `NEXT_PUBLIC_APP_NAME` | No | Display name. Defaults to "Connect HR". |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Yes | Contact address shown on the Terms and Privacy pages and in `security.txt`. |
| `NEXT_PUBLIC_LEGAL_ENTITY` | Yes | Registered business name shown on the legal pages. |
| `PAYMENT_INSTRUCTIONS` | Recommended | Shown on the membership page (bank account, JazzCash or Easypaisa details). |
| `LEGACY_TASKMARKET_ENABLED` | No | Leave unset. Setting it to `true` re-enables the retired escrow cron and FBR export endpoints. |
| `ADDRESS_ENCRYPTION_KEY`, `CRON_SECRET` | No | Only used by retired TaskMarket code. |

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

Don't run the demo seed in production. It creates accounts with the known password `password123`.

## 5. Production verification

After each deployment, check:

| Check | Expected |
|---|---|
| `GET /` | 200 with real job and member counts |
| `GET /jobs` | Lists only open, unexpired jobs. Search and filters work. |
| `GET /dashboard` signed out | Redirects to `/login` |
| Register a test candidate | Lands on `/profile?welcome=1` |
| Candidate opens `/admin` | Redirected to `/dashboard` |
| Admin opens `/admin` | Six statistics, request queue and audit log |
| `GET /api/cron/auto-release` | `410 Gone` (legacy endpoint retired) |
| Response headers on login | `Set-Cookie: tm_session=…; HttpOnly; Secure; SameSite=Lax` |

For a full regression run against a staging copy, use `scripts/e2e-smoke.mjs` (see the README). It must point at a database whose name contains `test`.

## 6. Operations notes

- **Membership expiry** needs no scheduler. Entitlements are checked by date on every request, and the admin pages mark lapsed memberships `EXPIRED`.
- **Job expiry** is also date-based. Expired jobs disappear from listings and stop accepting applications automatically.
- **Suspension** takes effect on the user's next request. Sessions are checked against account status every time.
- **Logs:** unexpected server-action errors are logged as `[server action] unexpected error`. Users only see a generic message.
- **Rate limiting** isn't built in. Put the app behind a proxy or WAF (Cloudflare, Nginx `limit_req`) that rate-limits `POST` requests to `/login` and `/signup`.
