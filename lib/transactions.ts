import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { fail } from "./errors";

function isSerializationFailure(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  const message = error instanceof Error ? error.message : "";
  return /40001|could not serialize|write conflict|deadlock/i.test(message);
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Runs `fn` in a SERIALIZABLE transaction, retrying on serialization conflicts.
 * Used wherever a limit is checked and then written (application and job caps,
 * membership requests) so concurrent requests cannot slip past the limit.
 */
export async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  conflictMessage: string,
  attempts = 4,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      if (attempt >= attempts) fail(conflictMessage);
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt + Math.random() * 25));
    }
  }
}
