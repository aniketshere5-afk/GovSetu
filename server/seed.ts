import { eq } from "drizzle-orm";
import {
  applications,
  connectors,
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
} from "../drizzle/schema";
import { getDb } from "./db";
import { writeAudit } from "./audit";

const MARKER = "demo-seed-v2";

let inflight: Promise<void> | null = null;

/**
 * Seed demo data exactly once per database. Guarded by a marker row and
 * per-entity existence checks so it is safe to call at every boot and cannot
 * produce the duplicate-key 500s the old per-request seeding caused.
 */
export async function ensureSeeded(): Promise<void> {
  if (inflight) return inflight;
  inflight = doSeed().catch(err => {
    console.error("[Seed] failed:", err);
  });
  return inflight;
}

async function doSeed(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Seed] database unavailable; skipping demo seed");
    return;
  }

  const [marker] = await db.select().from(seedMarkers).where(eq(seedMarkers.markerKey, MARKER)).limit(1);
  if (marker) return;

  const [existingDept] = await db.select({ id: departments.id }).from(departments).limit(1);
  if (!existingDept) {
    await db.insert(departments).values([
      { code: "REV", name: "Revenue Department", shortName: "Revenue", description: "Independent revenue and tax verification authority.", sourceSystem: "Revenue e-Verify Registry" },
      { code: "LAD", name: "Local Administration", shortName: "Local Admin", description: "Address and premises verification authority.", sourceSystem: "Municipal Property Ledger" },
      { code: "BR", name: "Business Registry", shortName: "Registry", description: "Final business registration authority.", sourceSystem: "National Business Register" },
    ]);
  }
  const depts = await db.select().from(departments);
  const rev = depts.find(d => d.code === "REV")!;
  const loc = depts.find(d => d.code === "LAD")!;
  const reg = depts.find(d => d.code === "BR")!;

  let [service] = await db.select().from(services).where(eq(services.slug, "business-registration"));
  if (!service) {
    await db.insert(services).values({
      slug: "business-registration",
      name: "Business Registration",
      description: "Register a new business through one connected service journey.",
      eligibility: "Any resident or authorized business representative with a valid identity document.",
      requiredDocuments: JSON.stringify(["Identity proof", "Proof of address", "Constitution document"]),
      expectedDays: 7,
    });
    [service] = await db.select().from(services).where(eq(services.slug, "business-registration"));
  }

  const [existingRoute] = await db.select().from(serviceDepartments).where(eq(serviceDepartments.serviceId, service.id)).limit(1);
  if (!existingRoute) {
    await db.insert(serviceDepartments).values([
      { serviceId: service.id, departmentId: rev.id, sequence: 1, stepKey: "identity", stepLabel: "Identity verification", requiredScope: "identity", slaDays: 2 },
      { serviceId: service.id, departmentId: loc.id, sequence: 2, stepKey: "address", stepLabel: "Address verification", requiredScope: "registered address", slaDays: 3 },
      { serviceId: service.id, departmentId: reg.id, sequence: 3, stepKey: "approval", stepLabel: "Registry approval", requiredScope: "business profile", slaDays: 2 },
    ]);
  }

  const [existingConnector] = await db.select().from(connectors).limit(1);
  if (!existingConnector) {
    await db.insert(connectors).values([
      { departmentId: rev.id, name: "Revenue e-Verify", endpoint: "/api/connectors/revenue/verify", systemType: "Legacy REST", status: "healthy", successRate: 99 },
      { departmentId: loc.id, name: "Municipal Ledger", endpoint: "/api/connectors/municipal/address", systemType: "SOAP bridge", status: "healthy", successRate: 97 },
      { departmentId: reg.id, name: "Business Register", endpoint: "/api/connectors/registry/decision", systemType: "Modern JSON API", status: "degraded", successRate: 94 },
    ]);
  }

  await seedDemoApplication(db, service.id, rev.id, loc.id, reg.id);

  await db.insert(seedMarkers).values({ markerKey: MARKER }).catch(() => undefined);
  console.log("[Seed] demo data ready");
}

async function seedDemoApplication(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, serviceId: number, revId: number, locId: number, regId: number) {
  const [existingApp] = await db.select().from(applications).where(eq(applications.applicationNumber, "SG-2026-00001"));
  if (existingApp) return;

  const [existingCitizen] = await db.select().from(users).where(eq(users.openId, "demo-citizen"));
  if (!existingCitizen) {
    await db.insert(users).values([
      { openId: "demo-citizen", name: "Aarav Mehta", email: "aarav@demo.setugov", loginMethod: "demo", role: "user" },
      { openId: "demo-official", name: "Nisha Rao", email: "nisha@demo.setugov", loginMethod: "demo", role: "official", departmentId: locId },
      { openId: "demo-admin", name: "Devika Shah", email: "devika@demo.setugov", loginMethod: "demo", role: "admin" },
    ]);
  }
  const [demo] = await db.select().from(users).where(eq(users.openId, "demo-citizen"));

  await db.insert(applications).values({
    applicationNumber: "SG-2026-00001",
    applicantId: demo.id,
    serviceId,
    businessName: "Northstar Foods",
    businessType: "Private Limited",
    address: "14 Residency Road, Bengaluru 560025",
    contact: "aarav@northstarfoods.in",
    status: "in_review",
    currentDepartmentId: locId,
    submittedAt: new Date(),
  });
  const [app] = await db.select().from(applications).where(eq(applications.applicationNumber, "SG-2026-00001"));

  await db.insert(workflowSteps).values([
    { applicationId: app.id, departmentId: revId, stepKey: "identity", label: "Identity verification", sequence: 1, status: "completed", responsibleRole: "Revenue official", requiredScope: "identity", startedAt: new Date(Date.now() - 86400000 * 3), completedAt: new Date(Date.now() - 86400000 * 2), remarks: "Identity validated against department source record." },
    { applicationId: app.id, departmentId: revId, stepKey: "revenue", label: "Revenue verification", sequence: 2, status: "completed", responsibleRole: "Revenue official", requiredScope: "identity", completedAt: new Date(Date.now() - 86400000), remarks: "No outstanding tax flags found." },
    { applicationId: app.id, departmentId: locId, stepKey: "address", label: "Address verification", sequence: 3, status: "in_progress", responsibleRole: "Local administration official", requiredScope: "registered address", startedAt: new Date(), slaDueAt: new Date(Date.now() + 86400000 * 3) },
    { applicationId: app.id, departmentId: regId, stepKey: "approval", label: "Department approval", sequence: 4, status: "pending", responsibleRole: "Registry officer", requiredScope: "business profile" },
    { applicationId: app.id, departmentId: regId, stepKey: "decision", label: "Final decision", sequence: 5, status: "pending", responsibleRole: "Registry officer", requiredScope: "business profile" },
  ]);

  await db.insert(documents).values([
    { applicationId: app.id, documentType: "Identity proof", fileName: "aadhaar-reference.pdf", referenceUrl: "department://identity/verified/ID-8842", status: "verified" },
    { applicationId: app.id, documentType: "Proof of address", fileName: "lease-deed.pdf", referenceUrl: "s3://setugov-demo/lease-deed.pdf", status: "referenced" },
  ]);

  const scopeList = ["identity", "business profile", "registered address"];
  await db.insert(consents).values({ applicationId: app.id, applicantId: demo.id, purpose: "Business registration verification", dataScopes: JSON.stringify(scopeList), status: "granted" });
  await db.insert(consentScopes).values(scopeList.map(scope => ({ applicationId: app.id, applicantId: demo.id, scope, purpose: "Business registration verification", status: "granted" as const })));

  await db.insert(integrationEvents).values([
    { applicationId: app.id, connectorId: 1, direction: "outbound", eventType: "verification.requested", sourceSchema: "revenue.source.v1", canonicalSchema: "setugov.identity.v1", status: "processed", fieldNames: "name,dateOfBirth", payloadSummary: "Requested identity check; mapped citizen_name → name, dob → dateOfBirth" },
    { applicationId: app.id, connectorId: 2, direction: "inbound", eventType: "address.verified", sourceSchema: "municipal.source.v1", canonicalSchema: "setugov.address.v1", status: "processed", fieldNames: "registeredAddress", payloadSummary: "Normalized fullAddress into canonical registeredAddress" },
  ]);

  await writeAudit(demo.id, "user", "application.submitted", "application", "SG-2026-00001", "Consent granted for three purpose-limited scopes.");
  await writeAudit(demo.id, "system", "connector.normalized", "integration_event", "1", "Independent source record retained by Revenue Department.");
}
