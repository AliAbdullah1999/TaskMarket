import nodemailer, { type Transporter } from "nodemailer";
import { APP_NAME, SUPPORT_EMAIL } from "./constants";

export type EmailMessage = { to: string; subject: string; text: string };

/** Messages "sent" while running the test suite, so tests can assert on them. */
export const testOutbox: EmailMessage[] = [];

/**
 * Absolute URL for a path, for links in emails, the sitemap and robots.txt.
 * Set APP_URL in production; on Vercel the project's production domain is used when it is not set.
 */
export function appUrl(path = "/") {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = (process.env.APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Two ways to send, chosen by which variables are set:
 * - SMTP (SMTP_USER + SMTP_PASS): any mailbox, including Gmail with an app password.
 *   Simple to set up and fine for demos and low volume.
 * - Resend (RESEND_API_KEY + EMAIL_FROM): a sending service for a verified domain.
 */
function provider(): "smtp" | "resend" | null {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  return null;
}

export function emailConfigured() {
  return provider() !== null;
}

let smtp: Transporter | undefined;

function smtpTransport() {
  const port = Number(process.env.SMTP_PORT || 465);
  smtp ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
  return smtp;
}

async function sendWithResend(message: EmailMessage) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend responded with status ${response.status}`);
}

let warnedUnconfigured = false;

/**
 * Sends a plain-text transactional email.
 * - Never throws: a mail outage must not fail the action that triggered it. Returns whether it was sent.
 * - Tests collect messages in `testOutbox`. Development without a provider prints the
 *   message to the server console, so sign-in links can be followed locally.
 * - Production without a provider drops the message (links are never logged) and warns once.
 */
export async function sendEmail(input: EmailMessage): Promise<boolean> {
  const message = { ...input, text: `${input.text}\n\n— ${APP_NAME}${SUPPORT_EMAIL ? `\nNeed help? ${SUPPORT_EMAIL}` : ""}` };
  if (process.env.NODE_ENV === "test") {
    testOutbox.push(message);
    return true;
  }
  const via = provider();
  if (!via) {
    if (process.env.NODE_ENV === "production") {
      if (!warnedUnconfigured) console.warn("[email] No email provider is configured (SMTP_USER/SMTP_PASS or RESEND_API_KEY/EMAIL_FROM); emails are not being sent.");
      warnedUnconfigured = true;
    } else {
      console.info(`[email] (not sent: no provider configured)\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    }
    return false;
  }
  try {
    if (via === "smtp") {
      await smtpTransport().sendMail({
        from: process.env.EMAIL_FROM || `${APP_NAME} <${process.env.SMTP_USER}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    } else {
      await sendWithResend(message);
    }
    return true;
  } catch (error) {
    console.error(`[email] could not send "${message.subject}" via ${via}`, error instanceof Error ? error.message : error);
    return false;
  }
}
