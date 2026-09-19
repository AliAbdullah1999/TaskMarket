# TaskMarket PK

TaskMarket PK is an escrow-protected marketplace for local services, tutoring, and freelance work in Pakistan. Customers post tasks and compare quotes from NTN-verified taskers. Accepted work is funded through escrow, with masked communication and FBR-ready seller summaries.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a PostgreSQL database and copy `.env.example` to `.env.local`. Set `DATABASE_URL`; the other secrets can remain empty for local development.

3. Create the database schema:

   ```bash
   npm run prisma:push
   ```

4. Load the demo marketplace data:

   ```bash
   npm run prisma:seed
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

Open http://localhost:3000.

To reset the local database and reload the demo data, run `npm run prisma:seed -- --reset`.

## Demo accounts

All demo accounts use the password `password123`:

| Role | Email |
| --- | --- |
| Admin | `admin@taskmarket.pk` |
| Customer | `ayesha@example.com` |
| Customer | `usman@example.com` |
| Business | `zafar@example.com` |
| Verified tasker | `hina@example.com` |
| Verified tasker | `bilal@example.com` |

The seed also includes open tasks, competing quotes, an in-progress escrow task, chat messages, a completed job, a payout, ratings, and an FBR report record.

## Useful commands

```bash
npm run typecheck
npm run lint
npm run build
npm run prisma:studio
```

## Production configuration

Set `DATABASE_URL`, `SESSION_SECRET`, `ADDRESS_ENCRYPTION_KEY`, and `CRON_SECRET` in the deployment environment. Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Call `GET /api/cron/auto-release` hourly with `Authorization: Bearer $CRON_SECRET` so eligible escrows release automatically. The endpoint returns `401` when the secret is missing or invalid.
