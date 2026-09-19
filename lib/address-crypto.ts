import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { secretKey } from "./secrets";

// AES-256-GCM so a leaked database dump does not expose customer home addresses.
export function encryptAddress(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey("ADDRESS_ENCRYPTION_KEY"), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptAddress(payload: string | null) {
  if (!payload) return null;
  try {
    const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", secretKey("ADDRESS_ENCRYPTION_KEY"), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
