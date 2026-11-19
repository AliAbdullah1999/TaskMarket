/** A user-facing failure. Anything else thrown from an action is a bug (or a Next.js redirect). */
export class ActionError extends Error {}

export function fail(message: string): never {
  throw new ActionError(message);
}
