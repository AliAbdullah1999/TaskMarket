#!/usr/bin/env node
/**
 * Integration test runner.
 *
 * 1. Resolves an isolated test database: TEST_DATABASE_URL, or DATABASE_URL (from the
 *    environment, .env.local or .env) with the database name replaced by `connecthr_test`.
 * 2. Refuses to run unless the database name contains "test", so it can never
 *    truncate a development or production database.
 * 3. Creates the database if needed and applies the Prisma migrations to it
 *    (which also verifies the migration history).
 * 4. Runs every tests/*.test.ts file with Node's built-in test runner.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");

function readEnvFile(name) {
  const file = path.join(root, name);
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const fileEnv = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };
let testUrl = process.env.TEST_DATABASE_URL || fileEnv.TEST_DATABASE_URL;
if (!testUrl) {
  const base = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
  if (!base) {
    console.error("Set TEST_DATABASE_URL (or DATABASE_URL) to run the integration tests.");
    process.exit(1);
  }
  const url = new URL(base);
  url.pathname = "/connecthr_test";
  testUrl = url.toString();
}

const parsed = new URL(testUrl);
const dbName = decodeURIComponent(parsed.pathname.slice(1));
if (!/test/i.test(dbName)) {
  console.error(`Refusing to run tests against "${dbName}": the test database name must contain "test".`);
  process.exit(1);
}

const admin = new URL(testUrl);
admin.pathname = "/postgres";
admin.search = "";
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const exists = await client.query("select 1 from pg_database where datname = $1", [dbName]);
if (!exists.rowCount) {
  await client.query(`create database "${dbName.replace(/"/g, '""')}"`);
  console.log(`Created test database ${dbName}.`);
}
await client.end();

const env = { ...process.env, DATABASE_URL: testUrl, NODE_ENV: "test" };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const migrate = spawnSync(npx, ["prisma", "migrate", "deploy"], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const files = readdirSync(path.join(root, "tests"))
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => path.join("tests", file));
const run = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", ...files], {
  cwd: root,
  env,
  stdio: "inherit",
});
process.exit(run.status ?? 1);
