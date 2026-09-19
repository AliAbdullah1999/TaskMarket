import { createHash } from "node:crypto";

const DEV_FALLBACK = "taskmarket-dev-only-secret-change-me";

/**
 * Returns a 32-byte key derived from an env secret. Production refuses to run
 * without the secret; development falls back to a fixed value so the app boots.
 */
export function secretKey(envName: "SESSION_SECRET" | "ADDRESS_ENCRYPTION_KEY") {
  const value = process.env[envName];
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${envName} must be set in production.`);
    }
    return createHash("sha256").update(`${envName}:${DEV_FALLBACK}`).digest();
  }
  return createHash("sha256").update(value).digest();
}
