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
const manifest = require(path.join(root, ".next/server/server-reference-manifest.json"));

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const DB = process.env.DATABASE_URL ?? "";
if (!/test/i.test(new URL(DB || "postgres://x/none").pathname)) {
  console.error("DATABASE_URL must point at the seeded test database.");
  process.exit(1);
}
const db = new pg.Client({ connectionString: DB.replace(/\?.*$/, "") });
await db.connect();
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

const actionIds = Object.fromEntries(Object.entries(manifest.node).map(([id, entry]) => [entry.exportedName, id]));
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? `  — ${detail}` : ""}`);
}

async function get(pathname, cookie) {
  const res = await fetch(BASE + pathname, { redirect: "manual", headers: cookie ? { cookie } : {} });
  return { status: res.status, location: res.headers.get("location") ?? "", text: await res.text() };
}

/** Calls a server action exactly as the browser does: Next-Action header + React-encoded (prevState, formData). */
async function act(pagePath, name, fields, cookie) {
  const id = actionIds[name];
  if (!id) throw new Error(`Unknown action ${name}`);
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
  const body = await encodeReply(name === "logout" ? [form] : [undefined, form]);
  const res = await fetch(BASE + pagePath, {
    method: "POST",
    redirect: "manual",
    headers: { "next-action": id, accept: "text/x-component", origin: BASE, ...(cookie ? { cookie } : {}) },
    body,
  });
  const setCookie = res.headers.getSetCookie().find((value) => value.startsWith("tm_session=")) ?? "";
  return {
    status: res.status,
    redirect: res.headers.get("x-action-redirect") ?? "",
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
const signupCandidate = await act("/signup", "signup", { userType: "CANDIDATE", fullName: "E2E Candidate", email: `cand${stamp}@e2e.test`, city: "Karachi", phone: "03001112222", password: "candidate1" });
expectRedirect("Candidate registration redirects to profile setup", signupCandidate, /^\/profile\?welcome=1/);
const C1 = signupCandidate.cookie;
record("Candidate registration sets a session cookie", Boolean(C1));

const signupEmployer = await act("/signup", "signup", { userType: "EMPLOYER", fullName: "E2E Recruiter", businessName: "E2E Traders", email: `emp${stamp}@e2e.test`, city: "Lahore", phone: "", password: "employer1" });
expectRedirect("Employer registration redirects to profile setup", signupEmployer, /^\/profile\?welcome=1/);
const E1 = signupEmployer.cookie;

expectText("Duplicate email is rejected", await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Dup", email: `CAND${stamp}@e2e.test`, city: "Karachi", password: "candidate1" }), /already exists/);
expectText("Signup cannot create an admin", await act("/signup", "signup", { userType: "ADMIN", fullName: "Evil", email: `evil${stamp}@e2e.test`, city: "Karachi", password: "candidate1" }), /candidate or employer/);
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
const signupPrivate = await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Private Person", email: `private${stamp}@e2e.test`, city: "Lahore", password: "private123" });
const C2 = signupPrivate.cookie;
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
const signupThird = await act("/signup", "signup", { userType: "CANDIDATE", fullName: "Third Candidate", email: `third${stamp}@e2e.test`, city: "Multan", password: "third1234" });
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
record("Legacy cron endpoint is retired (410)", (await get("/api/cron/auto-release")).status === 410);
record("Legacy FBR report endpoint is retired (410)", (await get("/api/admin/fbr-report", A)).status === 410);
const logout = await act("/dashboard", "logout", {}, C1);
record("Logout clears the session cookie", logout.cleared, `${logout.status} ${logout.redirect}`);

await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} end-to-end checks passed.`);
process.exit(failed.length ? 1 : 0);
