import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { consentScopes, consentAccessLog } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Purpose-limited consent enforcement.
 *
 * A department exchange may only touch a scope the citizen has actively granted
 * for this application. Every successful check is written to an append-only
 * access log the citizen can inspect.
 */
export async function assertScopeGranted(
  applicationId: number,
  scope: string,
  opts: { departmentId?: number | null; purpose: string },
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const [row] = await db
    .select()
    .from(consentScopes)
    .where(and(eq(consentScopes.applicationId, applicationId), eq(consentScopes.scope, scope)))
    .limit(1);

  const active =
    row &&
    row.status === "granted" &&
    (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now());

  if (!active) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Consent for "${scope}" is not granted for this application`,
    });
  }

  await db.insert(consentAccessLog).values({
    applicationId,
    departmentId: opts.departmentId ?? null,
    scope,
    purpose: opts.purpose,
  });
}

/** Whether every scope a step needs is currently granted (no logging). */
export async function scopeIsGranted(applicationId: number, scope: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db
    .select()
    .from(consentScopes)
    .where(and(eq(consentScopes.applicationId, applicationId), eq(consentScopes.scope, scope)))
    .limit(1);
  return Boolean(
    row &&
      row.status === "granted" &&
      (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()),
  );
}
