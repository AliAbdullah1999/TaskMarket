# CareerMarket PK

CareerMarket PK is a Pakistan-focused jobs and recruitment platform. Candidates create professional profiles, search vacancies, and manage applications. Employers publish jobs and review applicants from a hiring dashboard.

## Product roles

- **Candidate:** maintain a career profile, search open jobs, apply, and track application status.
- **Employer:** maintain a company profile, publish and close jobs, and review or update candidate applications.
- **Administrator:** monitor platform usage, manage accounts, and review plan requests.
- **Guest:** browse public jobs and create a candidate or employer account.

## Membership plans

The app includes a proposed monthly plan catalog and enforces access limits:

- Candidate free: up to 3 job applications per calendar month.
- Candidate Pro: unlimited applications.
- Employer free: 1 active job listing.
- Employer Growth: up to 5 active job listings.

Plan prices in `lib/constants.ts` are proposals, not finalized commercial pricing. A payment gateway is not integrated: requesting a plan does not charge the user or unlock paid features. Admins may activate a plan only after confirming an external payment and recording its reference. Do not present this as automated billing in production.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a PostgreSQL database and copy `.env.example` to `.env.local`. Set `DATABASE_URL`; the other secrets are only needed by retained legacy services.

3. Apply the schema:

   ```bash
   npm run prisma:push
   ```

4. Load demo data:

   ```bash
   npm run prisma:seed
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

Open http://localhost:3000.

To reset the local database and reseed, run `npm run prisma:seed -- --reset`. This deletes all application data.

## Demo accounts

All seeded demo accounts use the password `password123`:

| Role | Email |
| --- | --- |
| Admin | `admin@careermarket.pk` |
| Candidate | `amina@example.com` |
| Employer | `hiring@northstar.example` |
| Employer | `careers@orbital.example` |

The candidate has a sample application; the employer accounts have sample vacancies.

## Useful commands

```bash
npm run typecheck
npm run lint
npm run build
npm run prisma:studio
```

## Data transition

Legacy marketplace tables and records are retained in the Prisma schema to avoid destructive removal during this pivot. Former task and tasker pages redirect to the job area; legacy marketplace data is not automatically converted into job listings or candidate/employer profiles.

## Production readiness

Before charging users, integrate a payment provider with verified server-side callbacks, idempotency, subscription renewal/cancellation handling, and reconciliation. The current plan request flow is administrative scaffolding only. Configure `SESSION_SECRET` and `DATABASE_URL` for production; legacy address encryption and escrow cron settings are retained only for legacy services.
