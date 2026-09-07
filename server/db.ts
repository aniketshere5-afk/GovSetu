import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "./_core/env";
import {
  applications,
  auditLogs,
  connectors,
  consentAccessLog,
  consentScopes,
  consents,
  departments,
  documents,
  integrationEvents,
  seedMarkers,
  serviceDepartments,
  services,
  users,
  workflowSteps,
  type InsertUser,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbError: string | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      _dbError = String(error);
      console.warn("[Database] Failed to connect:", error);
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = {
    openId: user.openId,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  if (user.name !== undefined) updateSet.name = user.name;
  if (user.email !== undefined) updateSet.email = user.email;
  if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.departmentId !== undefined) {
    values.departmentId = user.departmentId;
    updateSet.departmentId = user.departmentId;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

/**
 * Applications visible to an actor.
 * - citizen: only their own
 * - official: every application that has *any* workflow step for their department
 *   (so routed-onward and closed cases stay visible, not just the current one)
 * - admin: all
 */
export async function listApplications(userId: number, role: string, departmentId?: number) {
  const db = await getDb();
  if (!db) return [];

  if (role === "user") {
    return db.select().from(applications).where(eq(applications.applicantId, userId)).orderBy(desc(applications.updatedAt));
  }

  if (role === "official" && departmentId) {
    const stepRows = await db
      .select({ applicationId: workflowSteps.applicationId })
      .from(workflowSteps)
      .where(eq(workflowSteps.departmentId, departmentId));
    const ids = Array.from(new Set(stepRows.map(r => r.applicationId)));
    if (ids.length === 0) return [];
    return db.select().from(applications).where(inArray(applications.id, ids)).orderBy(desc(applications.updatedAt));
  }

  return db.select().from(applications).orderBy(desc(applications.updatedAt));
}

export async function demoApplicationDetail() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({ id: applications.id }).from(applications).where(eq(applications.applicationNumber, "SG-2026-00001"));
  return row ? applicationDetail(row.id) : null;
}

export async function applicationDetail(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [application] = await db.select().from(applications).where(eq(applications.id, id));
  if (!application) return null;
  const [steps, docs, consent, scopes, events, accessLog] = await Promise.all([
    db.select().from(workflowSteps).where(eq(workflowSteps.applicationId, id)).orderBy(asc(workflowSteps.sequence)),
    db.select().from(documents).where(eq(documents.applicationId, id)),
    db.select().from(consents).where(eq(consents.applicationId, id)).orderBy(desc(consents.grantedAt)),
    db.select().from(consentScopes).where(eq(consentScopes.applicationId, id)).orderBy(asc(consentScopes.scope)),
    db.select().from(integrationEvents).where(eq(integrationEvents.applicationId, id)).orderBy(desc(integrationEvents.createdAt)),
    db.select().from(consentAccessLog).where(eq(consentAccessLog.applicationId, id)).orderBy(desc(consentAccessLog.createdAt)).limit(50),
  ]);
  return { application, steps, documents: docs, consent: consent[0], scopes, events, accessLog };
}

export async function dashboardStats() {
  const db = await getDb();
  if (!db) return { active: 0, pending: 0, approved: 0, rejected: 0, avgDays: null as number | null };
  const rows = await db
    .select({ status: applications.status, count: sql<number>`count(*)` })
    .from(applications)
    .groupBy(applications.status);
  const by = (s: string) => rows.filter(r => r.status === s).reduce((a, r) => a + Number(r.count), 0);

  const decided = await db
    .select({ submittedAt: applications.submittedAt, decidedAt: applications.decidedAt })
    .from(applications)
    .where(and(sql`${applications.submittedAt} is not null`, sql`${applications.decidedAt} is not null`));
  const spans = decided
    .map(r => (r.decidedAt!.getTime() - r.submittedAt!.getTime()) / 86_400_000)
    .filter(d => d >= 0);
  const avgDays = spans.length ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10 : null;

  return {
    active: by("submitted") + by("in_review") + by("action_required"),
    pending: by("in_review"),
    approved: by("approved"),
    rejected: by("rejected"),
    avgDays,
  };
}

export async function systemHealth() {
  const db = await getDb();
  if (!db) return { database: "unavailable" as const, error: _dbError, seeded: false, applications: 0 };
  try {
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)` }).from(applications);
    const [seeded] = await db.select().from(seedMarkers).limit(1);
    return { database: "ok" as const, error: null, seeded: Boolean(seeded), applications: Number(n) };
  } catch (error) {
    return { database: "error" as const, error: String(error), seeded: false, applications: 0 };
  }
}

export {
  applications,
  auditLogs,
  connectors,
  consentAccessLog,
  consentScopes,
  consents,
  departments,
  documents,
  integrationEvents,
  serviceDepartments,
  services,
  users,
  workflowSteps,
};
