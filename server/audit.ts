import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Tamper-evident audit log.
 *
 * The managed database has no trigger support, so immutability is enforced at
 * the application contract: writes are insert-only and every row carries
 * `rowHash = sha256(prevHash + canonical fields)`. Any edit or deletion breaks
 * the chain, which `verifyAuditChain()` detects.
 */

type AuditInput = {
  actorId: number | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: string | null;
};

// The database column is second-precision, so the chain hashes an epoch in
// *seconds* — never milliseconds — or a round-trip would break verification.
function canonicalLine(prevHash: string, e: AuditInput & { createdAtSec: number }): string {
  return JSON.stringify([
    prevHash,
    e.actorId ?? null,
    e.actorRole,
    e.action,
    e.entityType,
    e.entityId,
    e.metadata ?? null,
    e.createdAtSec,
  ]);
}

function hash(line: string): string {
  return createHash("sha256").update(line).digest("hex");
}

const GENESIS = "0".repeat(64);

export async function writeAudit(
  actorId: number | null,
  actorRole: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [last] = await db
    .select({ rowHash: auditLogs.rowHash })
    .from(auditLogs)
    .orderBy(desc(auditLogs.id))
    .limit(1);
  const prevHash = last?.rowHash ?? GENESIS;

  const createdAtSec = Math.floor(Date.now() / 1000);
  const entry: AuditInput = { actorId, actorRole, action, entityType, entityId, metadata: metadata ?? null };
  const rowHash = hash(canonicalLine(prevHash, { ...entry, createdAtSec }));

  await db.insert(auditLogs).values({
    ...entry,
    prevHash,
    rowHash,
    createdAt: new Date(createdAtSec * 1000),
  });
}

export type AuditChainResult = {
  ok: boolean;
  total: number;
  brokenAtId: number | null;
  headHash: string;
};

export async function verifyAuditChain(): Promise<AuditChainResult> {
  const db = await getDb();
  if (!db) return { ok: true, total: 0, brokenAtId: null, headHash: GENESIS };

  const rows = await db.select().from(auditLogs).orderBy(auditLogs.id);
  let prevHash = GENESIS;
  for (const row of rows) {
    const createdAtSec = Math.floor(
      (row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime()) / 1000,
    );
    const expected = hash(
      canonicalLine(prevHash, {
        actorId: row.actorId ?? null,
        actorRole: row.actorRole,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata ?? null,
        createdAtSec,
      }),
    );
    if (row.prevHash !== prevHash || row.rowHash !== expected) {
      return { ok: false, total: rows.length, brokenAtId: row.id, headHash: prevHash };
    }
    prevHash = row.rowHash ?? GENESIS;
  }
  return { ok: true, total: rows.length, brokenAtId: null, headHash: prevHash };
}
