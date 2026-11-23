#!/usr/bin/env node
/**
 * End-to-end smoke test against a RUNNING production server (`next start`) that is
 * connected to the seeded *test* database. It drives real HTTP requests, including
 * real Server Action calls, as guests, candidates, employers and an administrator.
 *
 *   E2E_BASE_URL=http://localhost:3100 DATABASE_URL=<test db url> node scripts/e2e-smoke.mjs
 *
 * The script refuses to run unless DATABASE_URL points at a database whose name contains "test".
 */
import { createRequire } from "node:module";
import path from "node:path";
import pg from "pg";

const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.edge");
const root = path.resolve(import.meta.dirname, "..");
const manifest = require(path.join(root, process.env.NEXT_DIST_DIR ?? ".next", "server/server-reference-manifest.json"));

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const DB = process.env.DATABASE_URL ?? "";
if (!/test/i.test(new URL(DB || "postgres://x/none").pathname)) {
  console.error("DATABASE_URL must point at the seeded test database.");
  process.exit(1);
}
const db = new pg.Client({ connectionString: DB.replace(/\?.*$/, "") });
await db.connect();
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
/** Stands in for clicking the emailed confirmation link (emails are not delivered in this environment). */
const confirmEmail = (email) => db.query(`update "User" set "emailVerifiedAt" = now() at time zone 'utc' where email = $1`, [email]);

const actionIds = Object.fromEntries(Object.entries(manifest.node).map(([id, entry]) => [entry.exportedName, id]));
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  — ${detail}` : ""}`);
}

async function get(pathname, cookie) {
  const res = await fetch(BASE + pathname, { redirect: "manual", headers: cookie ? { cookie } : {} });
  return { status: res.status, location: res.headers.get("location") ?? "", headers: res.headers, text: await res.text() };
}

/** Calls a server action exactly as the browser does: Next-Action header + React-encoded (prevState, formData). */
let fakeIp = 0;
async function act(pagePath, name, fields, cookie, ip) {
  // Each call comes from its own address unless a test pins one, so rate limits only trigger where a test intends.
  fakeIp += 1;
  const forwardedFor = ip ?? `198.51.100.${fakeIp % 250}`;
  const id = actionIds[name];
  if (!id) throw new Error(`Unknown action ${name}`);
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  const body = await encodeReply(name === "logout" ? [form] : [undefined, form]);
  const res = await fetch(BASE + pagePath, {
    method: "POST",
    redirect: "manual",
    headers: { "next-action": id, accept: "text/x-component", origin: BASE, "x-forwarded-for": forwardedFor, ...(cookie ? { cookie } : {}) },
    body,
  });
  const setCookie = res.headers.getSetCookie().find((value) => value.startsWith("tm_session=")) ?? "";
  return {
    status: res.status,
    redirect: res.headers.get("x-action-redirect") ?? "",
    rawCookie: setCookie,
    cookie: setCookie && !/tm_session=;/.test(setCookie) ? setCookie.split(";")[0] : "",
    cleared: /tm_session=;|tm_session=""|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(setCookie),
    text: await res.text(),
  };
}

const expectText = (name, response, pattern) => record(name, pattern.test(response.text), `status ${response.status} redirect ${response.redirect || response.location} body ${response.text.slice(0, 300)}`);
const expectRedirect = (name, response, pattern) => record(name, pattern.test(response.redirect || response.location), `got "${response.redirect || response.location}" (status ${response.status}) ${response.text.slice(0, 200)}`);

const stamp = Date.now();
const job = (title) => ({
  title,
  description: "We are hiring for a full-time role that involves daily reporting, coordination and customer communication.",
  requirements: "Relevant experience preferred.",
  category: "Administration",
  city: "Lahore",
  employmentType: "FULL_TIME",
  workplaceType: "ONSITE",
  salaryMin: "80000",
  salaryMax: "120000",
});

// ---------------------------------------------------------------- Authentication
const signupCandidate = await act("/signup", "signup", { userType: "CANDIDATE", fullName: "E2E Candidate", email: `cand${stamp}@e2e.test`, city: "Karachi", phone: "03001112222", password: "candidate1", acceptTerms: "on" });
expectRedirect("Candidate registration redirects to profile setup", signupCandidate, /^\/profile\?welcome=1/);
const C1 = signupCandidate.cookie;
record("Candidate registration sets a session cookie", Boolean(C1));

const signupEmployer = await act("/signup", "signup", { userType: "EMPLOYER", fullName: "E2E Recruiter", businessName: "E2E Traders", email: `emp${stamp}@e2e.test`, city: "Lahore", phone: "", password: "employer1", acceptTerms: "on" });
expectRedirect("Employer registration redirects to profile setup", signupEmployer, /^\/profile\?welcome=1/);
const E1 = signupEmployer.cookie;

// ---------------------------------------------------------------- Email confirmation gate
record("Unconfirmed members see the confirmation banner", (await get("/dashboard", C1)).text.includes("Confirm your email address"));
expectText("Unconfirmed employers cannot publish a job", await act("/jobs/new", "createJob", job("E2E Unconfirmed Employer Role"), E1), /confirm your email/);
expectText("Confirmation email can be resent", await act("/dashboard", "resendVerificationEmail", {}, C1), /Confirmation email sent/);
record("Invalid confirmation link is rejected", (await get("/verify-email?token=not-a-real-token")).text.includes("Link not valid"));
await confirmEmail(`cand${stamp}@e2e.test`);
await confirmEmail(`emp${stamp}@e2e.test`);
record("Banner disappears once the email is confirmed", !(await get("/dashboard", C1)).text.includes("Confirm your email address"));

// ---------------------------------------------------------------- Password reset
record("Forgot-password page renders", (await get("/forgot-password")).status === 200);
record("Login page links to password reset", (await get("/login")).text.includes('href="/forgot-password"'));
expectText("Reset request gives the same answer for unknown emails", await act("/forgot-password", "forgotPassword", { email: `nobody${stamp}@e2e.test` }), /If an account exists/);
expectText("Reset request for a real account gives the same answer", await act("/forgot-password", "forgotPassword", { email: `cand${stamp}@e2e.test` }), /If an account exists/);
record("A reset link is stored only as a hash", (await one(`select count(*)::int as n from "AuthToken" t join "User" u on u.id = t."userId" where u.email = $1 and t.purpose = 'PASSWORD_RESET' and length(t."tokenHash") = 64`, [`cand${stamp}@e2e.test`])).n === 1);
record("Invalid reset link shows an expiry notice", (await get("/reset-password?token=not-a-real-token")).text.includes("invalid or has expired"));
expectText("Invalid reset token cannot change a password", await act("/reset-password", "resetPassword", { token: "not-a-real-token", newPassword: "brand-new-pass-9", confirmPassword: "brand-new-pass-9" }), /invalid or has expired/);

expectText("Duplicate email is rejected", await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Dup", email: `CAND${stamp}@e2e.test`, city: "Karachi", password: "candidate1", acceptTerms: "on" }), /already exists/);
expectText("Signup cannot create an admin", await act("/signup", "signup", { userType: "ADMIN", fullName: "Evil", email: `evil${stamp}@e2e.test`, city: "Karachi", password: "candidate1", acceptTerms: "on" }), /candidate or employer/);
expectText("Invalid credentials are rejected", await act("/login", "login", { email: `cand${stamp}@e2e.test`, password: "wrongpass1" }), /Incorrect email or password/);
const relogin = await act("/login", "login", { email: `cand${stamp}@e2e.test`, password: "candidate1", next: "//evil.com" });
expectRedirect("Login succeeds and ignores an off-site next URL", relogin, /^\/dashboard/);
const adminLogin = await act("/login", "login", { email: "admin@careermarket.pk", password: "password123" });
expectRedirect("Admin can log in", adminLogin, /^\/dashboard/);
const A = adminLogin.cookie;
const E2 = (await act("/login", "login", { email: "hiring@northstar.example", password: "password123" })).cookie;

expectRedirect("Protected page redirects guests to login", await get("/dashboard"), /\/login/);
expectRedirect("Candidates cannot open the admin console", await get("/admin", C1), /\/dashboard/);
expectRedirect("Employers cannot open the admin console", await get("/admin", E1), /\/dashboard/);
expectRedirect("Candidates cannot open candidate search", await get("/candidates", C1), /\/dashboard/);
expectRedirect("Candidates cannot open the job form", await get("/jobs/new", C1), /\/dashboard/);
expectRedirect("Admin dashboard link goes to the console", await get("/dashboard", A), /\/admin/);

// ---------------------------------------------------------------- Candidate profile
expectText("Candidate can save a public profile", await act("/profile", "updateCandidateProfile", { headline: "Operations coordinator", summary: "Organised and detail-focused.", skills: "Excel, Customer Service", experienceYears: "4", isPublic: "on" }, C1), /Candidate profile saved/);
expectText("Employer cannot save a candidate profile", await act("/profile", "updateCandidateProfile", { headline: "x", summary: "", skills: "", experienceYears: "", isPublic: "on" }, E1), /Candidate access required/);
const signupPrivate = await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Private Person", email: `private${stamp}@e2e.test`, city: "Lahore", password: "private123", acceptTerms: "on" });
const C2 = signupPrivate.cookie;
await confirmEmail(`private${stamp}@e2e.test`);
await act("/profile", "updateCandidateProfile", { headline: "Hidden accountant", summary: "", skills: "Accounting", experienceYears: "6" }, C2);

// ---------------------------------------------------------------- Employer jobs, free limit
const firstJob = await act("/jobs/new", "createJob", job("E2E Office Coordinator 1"), E1);
expectRedirect("Employer can publish a job", firstJob, /^\/jobs\/[a-z0-9]+\?notice=published/);
const jobIds = [firstJob.redirect.match(/\/jobs\/([a-z0-9]+)/)?.[1]];
expectText("Free employer is limited to 1 active job", await act("/jobs/new", "createJob", job("E2E Office Coordinator 2"), E1), /allows 1 active job/);
expectText("Salary range is validated", await act("/jobs/new", "createJob", { ...job("E2E Bad Salary Role"), salaryMin: "200000", salaryMax: "100000" }, E2), /Minimum salary cannot exceed/);
expectText("Candidate search is blocked without Growth", await get("/candidates", E1), /Included with/);

// ---------------------------------------------------------------- Membership request + approval
expectText("Employer can request Growth with a reference", await act("/pricing", "requestSubscription", { plan: "EMPLOYER_GROWTH", reference: "IBFT-E2E-001" }, E1), /Request submitted/);
expectText("Conflicting second request is rejected", await act("/pricing", "requestSubscription", { plan: "EMPLOYER_GROWTH", reference: "" }, E1), /awaiting review/);
expectText("Employer cannot request the candidate plan", await act("/pricing", "requestSubscription", { plan: "CANDIDATE_PRO", reference: "" }, E2), /not available/);
expectText("Pending request does not unlock candidate search", await get("/candidates", E1), /Included with/);
const e1User = await one(`select id from "User" where email = $1`, [`emp${stamp}@e2e.test`]);
const e1Request = await one(`select id from "Subscription" where "userId" = $1 and status = 'REQUESTED'`, [e1User.id]);
expectText("Non-admin cannot approve a membership", await act("/admin", "reviewSubscription", { subscriptionId: e1Request.id, decision: "approve", paymentReference: "FAKE-123" }, E1), /Admin access required/);
expectText("Admin can approve a membership", await act("/admin", "reviewSubscription", { subscriptionId: e1Request.id, decision: "approve", paymentReference: "IBFT-E2E-001", note: "" }, A), /Membership activated for 30 days/);
const approved = await one(`select status, "reviewedById", "currentPeriodEnd" - "currentPeriodStart" as length from "Subscription" where id = $1`, [e1Request.id]);
record("Approved membership is ACTIVE for 30 days with reviewer recorded", approved.status === "ACTIVE" && Boolean(approved.reviewedById) && approved.length.days === 30, JSON.stringify(approved));
expectText("Approving twice is rejected", await act("/admin", "reviewSubscription", { subscriptionId: e1Request.id, decision: "approve", paymentReference: "IBFT-E2E-001" }, A), /already been reviewed/);

// ---------------------------------------------------------------- Growth limits + candidate search
for (let i = 2; i <= 5; i += 1) {
  const created = await act("/jobs/new", "createJob", job(`E2E Office Coordinator ${i}`), E1);
  jobIds.push(created.redirect.match(/\/jobs\/([a-z0-9]+)/)?.[1]);
}
record("Growth employer can hold 5 active jobs", jobIds.filter(Boolean).length === 5, JSON.stringify(jobIds));
expectText("Growth employer is limited to 5 active jobs", await act("/jobs/new", "createJob", job("E2E Office Coordinator 6"), E1), /allows 5 active jobs/);
const search = await get("/candidates?skill=excel", E1);
record("Growth employer can search public candidates by skill", search.status === 200 && search.text.includes("E2E Candidate"), `status ${search.status}`);
record("Candidate search never exposes email or phone", !search.text.includes(`cand${stamp}@e2e.test`) && !search.text.includes("03001112222"));
record("Private profiles do not appear in search", !(await get("/candidates?q=Hidden", E1)).text.includes("Private Person"));
const privateProfile = await one(`select p.id from "CandidateProfile" p join "User" u on u.id = p."userId" where u.email = $1`, [`private${stamp}@e2e.test`]);
record("Private profile page returns 404", (await get(`/candidates/${privateProfile.id}`, E1)).status === 404);

// ---------------------------------------------------------------- Invitations
const publicProfile = await one(`select p.id from "CandidateProfile" p join "User" u on u.id = p."userId" where u.email = $1`, [`cand${stamp}@e2e.test`]);
record("Candidate profile page offers an invitation form", (await get(`/candidates/${publicProfile.id}`, E1)).text.includes("Invite to apply"));
expectText("Growth employer can invite a candidate", await act(`/candidates/${publicProfile.id}`, "inviteCandidate", { profileId: publicProfile.id, jobId: jobIds[3], message: "We liked your profile." }, E1), /Invitation sent/);
expectText("Duplicate invitation is rejected", await act(`/candidates/${publicProfile.id}`, "inviteCandidate", { profileId: publicProfile.id, jobId: jobIds[3], message: "" }, E1), /already invited/);
expectText("Private candidates cannot be invited", await act(`/candidates/${privateProfile.id}`, "inviteCandidate", { profileId: privateProfile.id, jobId: jobIds[3], message: "" }, E1), /no longer available/);
expectText("Employers cannot invite to someone else's job", await act(`/candidates/${publicProfile.id}`, "inviteCandidate", { profileId: publicProfile.id, jobId: jobIds[3], message: "" }, E2), /Employer Growth|your own job/);
const invited = await get("/applications", C1);
record("Candidate sees the invitation and message", invited.text.includes("Invitations to apply") && invited.text.includes("We liked your profile."));
record("Invited candidate sees the invitation on the job page", (await get(`/jobs/${jobIds[3]}`, C1)).text.includes("invited you to apply"));

// ---------------------------------------------------------------- Applications + limits
for (const [index, id] of jobIds.slice(0, 3).entries()) {
  expectText(`Candidate application ${index + 1} of 3 succeeds`, await act(`/jobs/${id}`, "applyToJob", { jobId: id, coverLetter: "I am interested." }, C1), /Application submitted/);
}
expectText("Duplicate application is rejected", await act(`/jobs/${jobIds[0]}`, "applyToJob", { jobId: jobIds[0], coverLetter: "" }, C1), /already applied/);
expectText("Fourth free application this month is rejected", await act(`/jobs/${jobIds[3]}`, "applyToJob", { jobId: jobIds[3], coverLetter: "" }, C1), /all 3 free applications/);
expectText("Employers cannot apply", await act(`/jobs/${jobIds[3]}`, "applyToJob", { jobId: jobIds[3], coverLetter: "" }, E2), /Only candidate accounts/);
const myApps = await get("/applications", C1);
record("Candidate sees their application history", myApps.status === 200 && (myApps.text.match(/E2E Office Coordinator/g) ?? []).length >= 3);

// ---------------------------------------------------------------- Applicant review + ownership
const application = await one(`select a.id from "JobApplication" a join "User" u on u.id = a."candidateId" where u.email = $1 and a."jobId" = $2`, [`cand${stamp}@e2e.test`, jobIds[0]]);
expectText("Another employer cannot update the application", await act(`/jobs/${jobIds[0]}`, "updateApplicationStatus", { applicationId: application.id, status: "REJECTED" }, E2), /Application not found/);
expectText("Owner can shortlist an applicant", await act(`/jobs/${jobIds[0]}`, "updateApplicationStatus", { applicationId: application.id, status: "SHORTLISTED" }, E1), /Application status updated/);
const ownerView = await get(`/jobs/${jobIds[0]}`, E1);
record("Owner sees the applicant, cover letter and contact email", ownerView.text.includes("E2E Candidate") && ownerView.text.includes("I am interested.") && ownerView.text.includes(`cand${stamp}@e2e.test`));
const otherView = await get(`/jobs/${jobIds[0]}`, E2);
record("Other employers do not see applicants", otherView.status === 200 && !otherView.text.includes(`cand${stamp}@e2e.test`));
const candidateStatus = await get("/applications", C1);
record("Candidate sees the updated status", candidateStatus.text.includes("Shortlisted"));
expectText("Another employer cannot edit the job", await act(`/jobs/${jobIds[0]}/edit`, "updateJob", { jobId: jobIds[0], ...job("Hijacked job title here") }, E2), /does not belong/);
record("Another employer gets 404 on the edit page", (await get(`/jobs/${jobIds[0]}/edit`, E2)).status === 404);
expectText("Another employer cannot close the job", await act(`/jobs/${jobIds[0]}`, "closeJob", { jobId: jobIds[0] }, E2), /does not belong/);
expectRedirect("Owner can edit the job", await act(`/jobs/${jobIds[4]}/edit`, "updateJob", { jobId: jobIds[4], ...job("E2E Office Coordinator 5 (edited)") }, E1), /notice=updated/);
expectText("Owner can close the job", await act(`/jobs/${jobIds[4]}`, "closeJob", { jobId: jobIds[4] }, E1), /Job listing closed/);
const signupThird = await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Third Candidate", email: `third${stamp}@e2e.test`, city: "Multan", password: "third1234", acceptTerms: "on" });
await confirmEmail(`third${stamp}@e2e.test`);
expectText("Closed job rejects applications", await act(`/jobs/${jobIds[4]}`, "applyToJob", { jobId: jobIds[4], coverLetter: "" }, signupThird.cookie), /no longer accepting/);
const listing = await get("/jobs?q=E2E+Office", undefined);
record("Closed jobs are excluded from public listings", listing.text.includes("E2E Office Coordinator 1") && !listing.text.includes("Coordinator 5 (edited)"));
const filtered = await get("/jobs?q=E2E+Office&city=Karachi", undefined);
record("Keyword and city filters combine", filtered.status === 200 && !filtered.text.includes("E2E Office Coordinator 1"));

// ---------------------------------------------------------------- Admin account management
const c1User = await one(`select id from "User" where email = $1`, [`cand${stamp}@e2e.test`]);
expectText("Employer cannot suspend accounts", await act("/admin/accounts", "setUserStatus", { userId: c1User.id, status: "SUSPENDED" }, E1), /Admin access required/);
expectText("Admin can suspend an account", await act("/admin/accounts", "setUserStatus", { userId: c1User.id, status: "SUSPENDED" }, A), /Account suspended/);
expectRedirect("Suspended user's existing session stops working", await get("/dashboard", C1), /\/login/);
expectText("Suspended user cannot log in", await act("/login", "login", { email: `cand${stamp}@e2e.test`, password: "candidate1" }), /suspended/);
expectText("Admin can reactivate an account", await act("/admin/accounts", "setUserStatus", { userId: c1User.id, status: "ACTIVE" }, A), /Account reactivated/);
record("Reactivated user can use their session again", (await get("/dashboard", C1)).status === 200);
const audit = await one(`select count(*)::int as n from "AdminAuditLog" where "targetId" in ($1, $2)`, [c1User.id, e1Request.id]);
record("Admin actions are written to the audit log", audit.n >= 3, `found ${audit.n}`);

// ---------------------------------------------------------------- Admin dashboard figures
const adminPage = await get("/admin", A);
const counts = await one(`select
  (select count(*) from "User" where "userType" = 'CANDIDATE')::int as candidates,
  (select count(*) from "User" where "userType" = 'EMPLOYER')::int as employers,
  (select count(*) from "JobApplication")::int as applications`);
record("Admin dashboard shows database-driven figures", adminPage.status === 200 && [counts.candidates, counts.employers, counts.applications].every((n) => adminPage.text.includes(`>${n.toLocaleString()}<`)), JSON.stringify(counts));
record("Admin accounts and membership history pages load", (await get("/admin/accounts?q=E2E", A)).status === 200 && (await get("/admin/memberships", A)).status === 200);

// ---------------------------------------------------------------- Moderation
record("Admin job moderation page loads", (await get("/admin/jobs?q=E2E", A)).text.includes("E2E Office Coordinator 2"));
expectText("Employers cannot remove listings", await act("/admin/jobs", "removeJob", { jobId: jobIds[1], reason: "Trying to remove my rival" }, E2), /Admin access required/);
expectText("Removal needs a reason", await act("/admin/jobs", "removeJob", { jobId: jobIds[1], reason: "" }, A), /reason for removal/);
expectText("Admin can remove a listing", await act("/admin/jobs", "removeJob", { jobId: jobIds[1], reason: "Listing asks candidates for a fee." }, A), /Listing removed/);
record("Removed listing returns 404 to the public", (await get(`/jobs/${jobIds[1]}`)).status === 404);
record("Removed listing is gone from public search", !(await get("/jobs?q=E2E+Office")).text.includes("E2E Office Coordinator 2"));
const ownerRemoved = await get(`/jobs/${jobIds[1]}`, E1);
record("Owner sees why the listing was removed", ownerRemoved.status === 200 && ownerRemoved.text.includes("Listing asks candidates for a fee."));
record("Applicant can still open a removed listing they applied to", (await get(`/jobs/${jobIds[1]}`, C1)).status === 200);
await db.query(`update "User" set status = 'SUSPENDED' where email = $1`, [`emp${stamp}@e2e.test`]);
record("Jobs of a suspended employer are hidden from search", !(await get("/jobs?q=E2E+Office")).text.includes("E2E Office Coordinator 1"));
record("Jobs of a suspended employer return 404 to guests", (await get(`/jobs/${jobIds[3]}`)).status === 404);
await db.query(`update "User" set status = 'ACTIVE' where email = $1`, [`emp${stamp}@e2e.test`]);
record("Jobs return when the employer is reactivated", (await get("/jobs?q=E2E+Office")).text.includes("E2E Office Coordinator 1"));

// ---------------------------------------------------------------- Operations endpoints
const health = await get("/api/health");
record("Health check reports ok", health.status === 200 && /"status":"ok"/.test(health.text));
record("Daily maintenance endpoint rejects callers without the secret", (await get("/api/cron/daily")).status === 401);
const sitemap = await get("/sitemap.xml");
record("Sitemap lists open jobs and omits removed ones", sitemap.status === 200 && sitemap.text.includes(`/jobs/${jobIds[0]}`) && !sitemap.text.includes(`/jobs/${jobIds[1]}`));
record("robots.txt points at the sitemap", /Sitemap: .*\/sitemap\.xml/.test((await get("/robots.txt")).text));

// ---------------------------------------------------------------- Expiry removes benefits
await db.query(`update "Subscription" set "currentPeriodStart" = (now() at time zone 'utc') - interval '31 days', "currentPeriodEnd" = (now() at time zone 'utc') - interval '1 minute' where id = $1`, [e1Request.id]);
expectText("Expired Growth membership loses candidate search", await get("/candidates", E1), /Included with/);
expectText("Expired Growth membership falls back to the free job limit", await act("/jobs/new", "createJob", job("E2E After Expiry Role"), E1), /allows 1 active job/);
await get("/admin", A);
record("Lapsed membership is marked EXPIRED", (await one(`select status from "Subscription" where id = $1`, [e1Request.id])).status === "EXPIRED");

// ---------------------------------------------------------------- Pages, copy, legacy
for (const [label, pathname, cookie] of [
  ["guest home", "/", undefined], ["guest pricing", "/pricing", undefined], ["candidate dashboard", "/dashboard", C1], ["candidate profile", "/profile", C1],
  ["candidate account", "/account", C1], ["candidate pricing", "/pricing", C1], ["employer dashboard", "/dashboard", E1], ["employer manage jobs", "/jobs/manage", E1],
  ["employer applications", "/applications", E1], ["employer pricing", "/pricing", E1], ["employer post job", "/jobs/new", E2],
]) {
  const page = await get(pathname, cookie);
  record(`Page renders: ${label}`, page.status === 200, `status ${page.status} ${page.location}`);
}
record("Pricing does not advertise unimplemented benefits", !/priority placement|Unlimited applications to your vacancies/i.test((await get("/pricing")).text));
expectRedirect("Legacy /tasks redirects to jobs", await get("/tasks"), /\/jobs$/);
expectRedirect("Legacy tasker pages redirect to jobs", await get("/taskers/abc"), /\/jobs$/);
record("Legacy cron endpoint is gone (404)", (await get("/api/cron/auto-release")).status === 404);
record("Legacy FBR report endpoint is gone (404)", (await get("/api/admin/fbr-report", A)).status === 404);
// ---------------------------------------------------------------- Security headers and hardening
const home = await get("/");
const csp = home.headers.get("content-security-policy") ?? "";
const nonce = csp.match(/'nonce-([^']+)'/)?.[1] ?? "";
record("CSP: nonce-based script policy with strict-dynamic", /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp) && !/unsafe-eval/.test(csp), csp);
record("CSP: blocks framing, plugins and foreign form posts", ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].every((part) => csp.includes(part)), csp);
record("CSP: every script tag on the page carries the nonce", nonce.length > 10 && [...home.text.matchAll(/<script\b[^>]*>/g)].every((tag) => tag[0].includes(`nonce="${nonce}"`)));
record("CSP: nonce is different on every request", nonce !== ((await get("/")).headers.get("content-security-policy") ?? "").match(/'nonce-([^']+)'/)?.[1]);
record("Header: X-Content-Type-Options nosniff", home.headers.get("x-content-type-options") === "nosniff");
record("Header: X-Frame-Options DENY", home.headers.get("x-frame-options") === "DENY");
record("Header: Referrer-Policy", home.headers.get("referrer-policy") === "strict-origin-when-cross-origin");
record("Header: Permissions-Policy disables device features", /camera=\(\)/.test(home.headers.get("permissions-policy") ?? ""));
record("Header: Strict-Transport-Security", /max-age=63072000/.test(home.headers.get("strict-transport-security") ?? ""));
record("Header: framework is not advertised", !home.headers.has("x-powered-by"));
record("Session cookie is HttpOnly and SameSite=Lax", /HttpOnly/i.test(adminLogin.rawCookie) && /SameSite=lax/i.test(adminLogin.rawCookie), adminLogin.rawCookie);

record("Terms and Privacy pages render", (await get("/terms")).status === 200 && (await get("/privacy")).status === 200);
record("Signed-out footer links to the legal pages", home.text.includes('href="/terms"') && home.text.includes('href="/privacy"'));
record("robots.txt keeps private areas out of search engines", /Disallow: \/admin/.test((await get("/robots.txt")).text));
expectText("Signup is rejected without accepting the terms", await act("/signup", "signup", { userType: "CANDIDATE", fullName: "No Consent", email: `noconsent${stamp}@e2e.test`, city: "Karachi", password: "noconsent1" }), /accept the Terms/);
expectText("Common passwords are rejected at signup", await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Weak Pass", email: `weak${stamp}@e2e.test`, city: "Karachi", password: "password123", acceptTerms: "on" }), /too common/);

// Brute-force lockout: five wrong passwords, then even the right one is refused.
const victim = await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Lockout Target", email: `lock${stamp}@e2e.test`, city: "Karachi", password: "lockout-good-1", acceptTerms: "on" });
await confirmEmail(`lock${stamp}@e2e.test`);
for (let i = 0; i < 5; i += 1) await act("/login", "login", { email: `lock${stamp}@e2e.test`, password: `wrong-guess-${i}` });
expectText("Account locks after five wrong passwords", await act("/login", "login", { email: `lock${stamp}@e2e.test`, password: "lockout-good-1" }), /Too many attempts/);
const pinnedIp = "203.0.113.50";
let sprayBlocked = false;
for (let i = 0; i < 32 && !sprayBlocked; i += 1) {
  sprayBlocked = /Too many attempts/.test((await act("/login", "login", { email: `spray${i}-${stamp}@e2e.test`, password: "guess-1234" }, undefined, pinnedIp)).text);
}
record("One address is throttled when guessing across many accounts", sprayBlocked);

// Session revocation: a password change signs out other devices but keeps this one.
const deviceA = victim.cookie;
await db.query(`delete from "RateLimit"`);
const deviceB = (await act("/login", "login", { email: `lock${stamp}@e2e.test`, password: "lockout-good-1" })).cookie;
const changed = await act("/account", "updatePassword", { currentPassword: "lockout-good-1", newPassword: "lockout-newer-2", confirmPassword: "lockout-newer-2" }, deviceB);
expectText("Password can be changed", changed, /Password updated/);
expectRedirect("Password change signs out other devices", await get("/dashboard", deviceA), /\/login/);
record("Password change keeps the current device signed in", Boolean(changed.cookie) && (await get("/dashboard", changed.cookie)).status === 200);
const deviceC = changed.cookie;
expectRedirect("Sign out everywhere redirects to login", await act("/account", "signOutAllDevices", {}, deviceC), /^\/login/);
expectRedirect("Sign out everywhere revokes the session", await get("/dashboard", deviceC), /\/login/);

// Data rights: export and deletion.
record("Data export requires sign-in", (await get("/account/export")).status === 401);
const deviceD = (await act("/login", "login", { email: `lock${stamp}@e2e.test`, password: "lockout-newer-2" })).cookie;
const exported = await get("/account/export", deviceD);
record("Data export returns the user's data without the password hash", exported.status === 200 && exported.text.includes(`lock${stamp}@e2e.test`) && !/passwordHash|scrypt\$/.test(exported.text));
expectText("Account deletion needs the correct password", await act("/account", "removeAccount", { password: "not-my-password-1", confirmation: "DELETE" }, deviceD), /password is incorrect/);
expectRedirect("Account can be deleted", await act("/account", "removeAccount", { password: "lockout-newer-2", confirmation: "DELETE" }, deviceD), /account=deleted/);
record("Deleted account is gone from the database", (await one(`select count(*)::int as n from "User" where email = $1`, [`lock${stamp}@e2e.test`])).n === 0);
expectRedirect("Deleted account's session no longer works", await get("/dashboard", deviceD), /\/login/);

const logout = await act("/dashboard", "logout", {}, C1);
record("Logout clears the session cookie", logout.cleared, `${logout.status} ${logout.redirect}`);

await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} end-to-end checks passed.`);
process.exit(failed.length ? 1 : 0);
