import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "./_core/env";
import { applications, auditLogs, connectors, consents, departments, documents, integrationEvents, serviceDepartments, services, users, workflowSteps, type InsertUser } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  if (user.name !== undefined) updateSet.name = user.name;
  if (user.email !== undefined) updateSet.email = user.email;
  if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod;
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return rows[0]; }

export async function seedDemoData() {
  const db = await getDb(); if (!db) return;
  const existing = await db.select({ id: departments.id }).from(departments).limit(1);
  if (existing.length) return;
  const [rev] = await db.insert(departments).values({ code: "REV", name: "Revenue Department", shortName: "Revenue", description: "Independent revenue and tax verification authority.", sourceSystem: "Revenue e-Verify Registry" }).$returningId();
  const [loc] = await db.insert(departments).values({ code: "LAD", name: "Local Administration", shortName: "Local Admin", description: "Address and premises verification authority.", sourceSystem: "Municipal Property Ledger" }).$returningId();
  const [reg] = await db.insert(departments).values({ code: "BR", name: "Business Registry", shortName: "Registry", description: "Final business registration authority.", sourceSystem: "National Business Register" }).$returningId();
  const [service] = await db.insert(services).values({ slug: "business-registration", name: "Business Registration", description: "Register a new business through one connected service journey.", eligibility: "Any resident or authorized business representative with a valid identity document.", requiredDocuments: JSON.stringify(["Identity proof", "Proof of address", "Constitution document"]), expectedDays: 7 }).$returningId();
  await db.insert(serviceDepartments).values([{ serviceId: service.id, departmentId: rev.id, sequence: 1 }, { serviceId: service.id, departmentId: loc.id, sequence: 2 }, { serviceId: service.id, departmentId: reg.id, sequence: 3 }]);
  await db.insert(connectors).values([{ departmentId: rev.id, name: "Revenue e-Verify", endpoint: "/connectors/revenue/verify", systemType: "Legacy REST", status: "healthy", successRate: 99 }, { departmentId: loc.id, name: "Municipal Ledger", endpoint: "/connectors/local/address", systemType: "SOAP bridge", status: "healthy", successRate: 97 }, { departmentId: reg.id, name: "Business Register", endpoint: "/connectors/registry/decision", systemType: "Modern JSON API", status: "degraded", successRate: 94 }]);
  await seedDemoApplication(db, service.id, rev.id, loc.id, reg.id);
}

async function seedDemoApplication(db: any, serviceId: number, revId: number, locId: number, regId: number) {
  const [demo] = await db.insert(users).values({ openId: "demo-citizen", name: "Aarav Mehta", email: "aarav@demo.setugov", loginMethod: "demo", role: "user" }).$returningId();
  await db.insert(users).values([{ openId: "demo-official", name: "Nisha Rao", email: "nisha@demo.setugov", loginMethod: "demo", role: "official", departmentId: locId }, { openId: "demo-admin", name: "Devika Shah", email: "devika@demo.setugov", loginMethod: "demo", role: "admin" }]);
  const [app] = await db.insert(applications).values({ applicationNumber: "SG-2026-00001", applicantId: demo.id, serviceId, businessName: "Northstar Foods", businessType: "Private Limited", address: "14 Residency Road, Bengaluru 560025", contact: "aarav@northstarfoods.in", status: "in_review", currentDepartmentId: locId, submittedAt: new Date() }).$returningId();
  await db.insert(workflowSteps).values([
    { applicationId: app.id, departmentId: revId, stepKey: "identity", label: "Identity verification", sequence: 1, status: "completed", responsibleRole: "Revenue official", startedAt: new Date(Date.now() - 86400000 * 3), completedAt: new Date(Date.now() - 86400000 * 2), remarks: "Identity validated against department source record." },
    { applicationId: app.id, departmentId: revId, stepKey: "revenue", label: "Revenue verification", sequence: 2, status: "completed", responsibleRole: "Revenue official", completedAt: new Date(Date.now() - 86400000), remarks: "No outstanding tax flags found." },
    { applicationId: app.id, departmentId: locId, stepKey: "address", label: "Address verification", sequence: 3, status: "in_progress", responsibleRole: "Local administration official", startedAt: new Date() },
    { applicationId: app.id, departmentId: regId, stepKey: "approval", label: "Department approval", sequence: 4, status: "pending", responsibleRole: "Registry officer" },
    { applicationId: app.id, departmentId: regId, stepKey: "decision", label: "Final decision", sequence: 5, status: "pending", responsibleRole: "Registry officer" },
  ]);
  await db.insert(documents).values([{ applicationId: app.id, documentType: "Identity proof", fileName: "aadhaar-reference.pdf", referenceUrl: "department://identity/verified/ID-8842", status: "verified" }, { applicationId: app.id, documentType: "Proof of address", fileName: "lease-deed.pdf", referenceUrl: "s3://setugov-demo/lease-deed.pdf", status: "referenced" }]);
  await db.insert(consents).values({ applicationId: app.id, applicantId: demo.id, purpose: "Business registration verification", dataScopes: JSON.stringify(["identity", "business profile", "registered address"]), status: "granted" });
  await db.insert(integrationEvents).values([{ applicationId: app.id, connectorId: 1, direction: "outbound", eventType: "verification.requested", sourceSchema: "revenue.citizen_name + dob", canonicalSchema: "setugov.identity.v1", status: "processed", payloadSummary: "Mapped citizen_name → name; dob → dateOfBirth" }, { applicationId: app.id, connectorId: 2, direction: "inbound", eventType: "address.verified", sourceSchema: "municipal.fullAddress", canonicalSchema: "setugov.address.v1", status: "processed", payloadSummary: "Normalized fullAddress into canonical registeredAddress" }]);
  await db.insert(auditLogs).values([{ actorId: demo.id, actorRole: "user", action: "application.submitted", entityType: "application", entityId: "SG-2026-00001", metadata: "Consent granted for three purpose-limited scopes." }, { actorId: demo.id, actorRole: "system", action: "connector.normalized", entityType: "integration_event", entityId: "1", metadata: "Independent source record retained by Revenue Department." }]);
}

export async function listApplications(userId: number, role: string, departmentId?: number) {
  const db = await getDb(); if (!db) return [];
  const condition = role === "user" ? eq(applications.applicantId, userId) : departmentId ? eq(applications.currentDepartmentId, departmentId) : undefined;
  return db.select().from(applications).where(condition).orderBy(desc(applications.updatedAt));
}
export async function demoApplicationDetail() { const db = await getDb(); if (!db) return null; const [row] = await db.select({ id: applications.id }).from(applications).where(eq(applications.applicationNumber, "SG-2026-00001")); return row ? applicationDetail(row.id) : null; }

export async function applicationDetail(id: number) {
  const db = await getDb(); if (!db) return null;
  const [application] = await db.select().from(applications).where(eq(applications.id, id));
  if (!application) return null;
  const [steps, docs, consent, events] = await Promise.all([db.select().from(workflowSteps).where(eq(workflowSteps.applicationId, id)).orderBy(asc(workflowSteps.sequence)), db.select().from(documents).where(eq(documents.applicationId, id)), db.select().from(consents).where(eq(consents.applicationId, id)).orderBy(desc(consents.grantedAt)), db.select().from(integrationEvents).where(eq(integrationEvents.applicationId, id)).orderBy(desc(integrationEvents.createdAt))]);
  return { application, steps, documents: docs, consent: consent[0], events };
}
export async function writeAudit(actorId: number | null, actorRole: string, action: string, entityType: string, entityId: string, metadata?: string) { const db = await getDb(); if (!db) return; await db.insert(auditLogs).values({ actorId, actorRole, action, entityType, entityId, metadata }); }
export async function dashboardStats() { const db = await getDb(); if (!db) return { active: 0, pending: 0, approved: 0, avgDays: 3.2 }; const rows = await db.select({ status: applications.status, count: sql<number>`count(*)` }).from(applications).groupBy(applications.status); return { active: rows.filter(r => ["submitted", "in_review", "action_required"].includes(r.status)).reduce((a, r) => a + Number(r.count), 0), pending: rows.filter(r => r.status === "in_review").reduce((a, r) => a + Number(r.count), 0), approved: rows.filter(r => r.status === "approved").reduce((a, r) => a + Number(r.count), 0), avgDays: 3.2 }; }
export { applications, auditLogs, connectors, consents, departments, documents, integrationEvents, serviceDepartments, services, workflowSteps };
