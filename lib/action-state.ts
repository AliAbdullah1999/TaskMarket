export type ActionState = { error?: string; success?: string } | undefined;

/** A user-facing failure. Anything else thrown from an action is a bug (or a redirect). */
export class ActionError extends Error {}

export function fail(message: string): never {
  throw new ActionError(message);
}

export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const success = await fn();
    return success ? { success } : {};
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    throw error;
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
