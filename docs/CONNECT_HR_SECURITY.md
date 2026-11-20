# Connect HR — Security Overview

**Last reviewed:** 2026-11-20

This document compares the application with common industry standards, says what is implemented and how it was verified, and lists what still needs to be done outside the code.

Standards used for the comparison:

- **OWASP Top 10 (2021)**, the most widely used list of web application risks
- **OWASP ASVS 4.0, Level 1**, the baseline verification checklist for any internet-facing app
- **NIST SP 800-63B**, the reference for password and session rules
- **OWASP Secure Headers Project**, for browser security headers

## 1. The three principles you asked about

| Principle | Status | How it works here |
|---|---|---|
| **Server-side authentication and authorization.** Never rely on hiding things in the frontend. | Done | Every rule runs on the server in `lib/services/*`. The user's identity and role come from the signed session cookie, never from the form. Ownership is part of each database query (for example, a job update only matches rows where `employerId` is the signed-in user). Tests call the services directly as the wrong user and confirm each attempt is refused. |
| **Protected secrets.** No keys in client code. | Done | Secrets are read from environment variables on the server only (`DATABASE_URL`, `SESSION_SECRET`). The only values sent to the browser are the app name, legal entity name and support email (`NEXT_PUBLIC_*`), which are public by design. `.env*` files are git-ignored. Production refuses to start without `SESSION_SECRET`. |
| **Input validation and database rules,** including Row Level Security. | Done | All input is validated on the server (types, lengths, allowed values, salary ranges). Prisma parameterises every query, so SQL injection is not possible through normal use. Row Level Security is enabled on all 16 tables. There are no file uploads, so there is nothing to restrict there. If uploads are added later, they need type, size and storage rules. |

### What Row Level Security does in this app

The app talks to PostgreSQL through one server-side role, which owns the tables. RLS is switched on for every table with no policies, which means: the owner (the app) works as before, and **every other database role is denied by default**. This matters most on hosts that expose a public data API on top of the database, such as Supabase, where tables without RLS can be read by anyone holding the public key. Per-user access rules stay in the application layer, where they are tested.

Any table added in a future migration must also run `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY;`. A test fails if one is missed.

## 2. Comparison with OWASP Top 10

| Risk | Status | What is in place |
|---|---|---|
| A01 Broken access control | Done | Role and ownership checks in every service. Admin pages and actions require the admin role. Private candidate profiles return 404. RLS as a second layer. Legacy TaskMarket actions are not callable, and its endpoints return 410. |
| A02 Cryptographic failures | Done | Passwords hashed with scrypt and a per-user salt. Sessions signed with HMAC-SHA-256. HSTS forces HTTPS. Cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`. |
| A03 Injection (SQL, XSS) | Done | Parameterised queries only. React escapes all output, and there is no raw HTML rendering. A strict nonce-based Content Security Policy blocks injected scripts as a second layer. |
| A04 Insecure design | Done | Plan limits and membership approval enforced in serializable transactions, tested with parallel requests. Pending or rejected memberships can never unlock features. |
| A05 Security misconfiguration | Done | Security headers on every response (see section 4). Framework header removed. Generic error messages; details are only logged on the server. |
| A06 Vulnerable components | Mostly | Next.js upgraded 16.3.5 to 16.4.6, which fixes a critical advisory. `npm audit` is down from 7 findings (1 critical) to 4. The remaining 4 are in the Prisma command-line tool's dependencies and need the Prisma 7 major upgrade (see section 6). |
| A07 Authentication failures | Mostly | Account lockout after 5 wrong passwords, per-address throttling, common-password blocklist, identical error for unknown email and wrong password, session revocation. Missing: email verification, password reset by email and two-factor sign-in (section 6). |
| A08 Integrity failures | Done | Dependencies pinned by `package-lock.json`. Server Actions verify the request origin. |
| A09 Logging and monitoring | Partial | Admin actions are written to an audit log. Unexpected errors are logged. There is no alerting or central log monitoring yet (section 6). |
| A10 Server-side request forgery | Not applicable | The server never fetches URLs supplied by users. |

## 3. Sign-in, passwords and sessions (NIST 800-63B)

| Control | Setting |
|---|---|
| Password rules | 8 to 128 characters with a letter and a number. Rejected if it is on a list of commonly guessed passwords or contains the user's email name. No forced symbol rules, in line with NIST guidance. |
| Account lockout | 5 wrong passwords lock sign-in for that account for 15 minutes. Unknown emails lock the same way, so the lockout does not reveal which accounts exist. |
| Per-address throttling | 30 sign-in attempts per 15 minutes and 5 sign-ups per hour from one network address. |
| Other limits | Password change and account deletion: 5 attempts per 15 minutes. Membership requests: 6 per hour. |
| Where limits are stored | In PostgreSQL (`RateLimit` table), so they hold across serverless instances and restarts. Keys are hashed; raw emails and addresses are never stored. |
| Session lifetime | 14 days, signed cookie. |
| Session revocation | Changing the password signs out every other device. "Sign out of all devices" is in Account settings. Suspended accounts lose access on their next request. |
| Consent | Sign-up requires accepting the Terms and Privacy Policy. The time of acceptance is stored. |

## 4. Browser security headers

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` and more | Only scripts carrying a fresh per-request nonce can run. No `unsafe-inline` or `unsafe-eval` for scripts in production. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Browsers always use HTTPS. |
| `X-Content-Type-Options` | `nosniff` | Stops content-type guessing. |
| `X-Frame-Options` | `DENY` | Stops the site being framed (clickjacking). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Does not leak full URLs to other sites. |
| `Permissions-Policy` | camera, microphone, geolocation, payment, USB off | The app uses none of these. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the site's windows. |

The CSP lives in `proxy.ts`. The other headers live in `next.config.ts`. Styles allow inline attributes (`style-src 'unsafe-inline'`), which is the common practical setting; the script policy is the strict part.

## 5. Privacy and legal

| Item | Where |
|---|---|
| Terms of Service | `/terms` |
| Privacy Policy, including the cookie statement | `/privacy` |
| Download my data | Account settings, served by `/account/export` |
| Delete my account (password and typed confirmation required) | Account settings |
| Profile visibility control, private by default | Profile page |
| Search engines kept out of signed-in areas | `/robots.txt` |
| Security contact for researchers (RFC 9116) | `/.well-known/security.txt`, active once `NEXT_PUBLIC_SUPPORT_EMAIL` is set |

The site uses one essential sign-in cookie and no analytics or advertising cookies, so a cookie consent banner is not required. If analytics or ad tracking is added later, a consent banner will be needed and the Privacy Policy must be updated.

**The Terms and Privacy Policy are templates written to match how the app actually works. They are not legal advice.** Have a lawyer qualified in Pakistan review them before launch. Points to confirm with them: the refund wording in the Terms, the liability cap, your registered business name and address, and obligations under the Prevention of Electronic Crimes Act 2016 and Pakistan's data protection legislation as it stands at launch.

## 6. What is not done yet

These need a decision, an outside service, or infrastructure, so they are not in the code.

| Gap | Why it matters | What it needs |
|---|---|---|
| Email verification at sign-up | Without it, anyone can register with someone else's email address. | An email sending provider (for example Resend, Postmark or Amazon SES). |
| Password reset by email | Users who forget their password currently have no self-service way back in. | The same email provider. |
| Two-factor sign-in for administrators | An admin account can approve memberships and suspend users, so it is the most valuable target. | A design decision, then about a day of work (authenticator app codes). |
| Prisma 7 upgrade | Clears the last 4 `npm audit` findings. They are in the command-line tool used for migrations, not in code that handles visitor requests. | A planned major-version upgrade and retest. |
| Network-level protection | App-level limits do not stop a large flood of traffic. | A web application firewall or DDoS protection in front of the site (Vercel and Cloudflare both offer this). |
| Monitoring and alerts | Nobody is told when errors spike or sign-in attacks happen. | An error tracker and log alerts. |
| Database backups | Protects against data loss. | Turn on automatic backups with your database host and test a restore. |
| Independent security test | A second pair of eyes before handling real users' data. | A penetration test by an outside firm. |
| Database connection role | RLS protects against other roles only if the app keeps using the table owner role and no shared superuser. | Use a dedicated database user for the app in production, with a strong password. |

## 7. How this was verified

| Check | Result on 2026-11-20 |
|---|---|
| Integration tests (`npm test`), including 18 security tests | 78 of 78 pass |
| End-to-end checks against the production build (`scripts/e2e-smoke.mjs`), including 29 security checks | 111 of 111 pass |
| Real browser check under the CSP (headless Chrome on 5 pages) | No CSP violations, no console errors, scripts run |
| Typecheck, lint, production build | Pass |
| `npm audit --omit=dev` | 4 high (Prisma CLI chain), 0 critical |

The security tests cover: lockout after five wrong passwords, lockout expiry, reset on success, identical behaviour for unknown emails, per-address throttling, sign-up throttling, hashed limiter keys, atomic counters, common-password rejection, required consent, session revocation on password change and sign-out-everywhere, data export without the password hash, account deletion rules, and RLS enabled on every table.
