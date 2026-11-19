import { unstable_rethrow } from "next/navigation";
import { ActionError, fail } from "./errors";

export { ActionError, fail };

export type ActionState = { error?: string; success?: string } | undefined;

const GENERIC_ERROR = "Something went wrong on our side. Please try again in a moment.";

/**
 * Runs a server-action body and converts failures into form state. User-facing
 * `ActionError`s are shown as-is; unexpected errors (database outages, bugs) are
 * logged on the server and replaced with a generic message so internals never leak.
 */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const success = await fn();
    return success ? { success } : {};
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    unstable_rethrow(error);
    console.error("[server action] unexpected error", error);
    return { error: GENERIC_ERROR };
  }
}

export function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function int(formData: FormData, name: string) {
  const raw = text(formData, name).replace(/,/g, "");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : NaN;
}
