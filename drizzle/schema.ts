import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "official", "admin"]).default("user").notNull(),
  departmentId: int("departmentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  shortName: varchar("shortName", { length: 64 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "paused"]).default("active").notNull(),
  sourceSystem: varchar("sourceSystem", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  eligibility: text("eligibility").notNull(),
  requiredDocuments: text("requiredDocuments").notNull(),
  expectedDays: int("expectedDays").notNull(),
  status: mysqlEnum("status", ["available", "paused"]).default("available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const serviceDepartments = mysqlTable("service_departments", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  departmentId: int("departmentId").notNull(),
  sequence: int("sequence").notNull(),
  stepKey: varchar("stepKey", { length: 80 }).notNull().default("verification"),
  stepLabel: varchar("stepLabel", { length: 160 }).notNull().default("Verification"),
  requiredScope: varchar("requiredScope", { length: 80 }),
  slaDays: int("slaDays").notNull().default(3),
});

export const applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  applicationNumber: varchar("applicationNumber", { length: 32 }).notNull().unique(),
  applicantId: int("applicantId").notNull(),
  serviceId: int("serviceId").notNull(),
  businessName: varchar("businessName", { length: 180 }).notNull(),
  businessType: varchar("businessType", { length: 100 }).notNull(),
  registrationNumber: varchar("registrationNumber", { length: 80 }),
  address: text("address").notNull(),
  contact: varchar("contact", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "in_review", "action_required", "approved", "rejected"]).default("draft").notNull(),
  currentDepartmentId: int("currentDepartmentId"),
  submittedAt: timestamp("submittedAt"),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const workflowSteps = mysqlTable("workflow_steps", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  departmentId: int("departmentId").notNull(),
  stepKey: varchar("stepKey", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  sequence: int("sequence").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "blocked", "rejected"]).default("pending").notNull(),
  responsibleRole: varchar("responsibleRole", { length: 100 }).notNull(),
  requiredScope: varchar("requiredScope", { length: 80 }),
  remarks: text("remarks"),
  slaDueAt: timestamp("slaDueAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  documentType: varchar("documentType", { length: 100 }).notNull(),
  fileName: varchar("fileName", { length: 240 }).notNull(),
  storageKey: varchar("storageKey", { length: 255 }),
  referenceUrl: text("referenceUrl"),
  status: mysqlEnum("status", ["referenced", "verified", "rejected"]).default("referenced").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** One reusable document per citizen (the "document vault"). */
export const vaultDocuments = mysqlTable("vault_documents", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  documentType: varchar("documentType", { length: 100 }).notNull(),
  fileName: varchar("fileName", { length: 240 }).notNull(),
  storageKey: varchar("storageKey", { length: 255 }),
  referenceUrl: text("referenceUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Purpose record for an application. Individual scopes live in consent_scopes. */
export const consents = mysqlTable("consents", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  applicantId: int("applicantId").notNull(),
  purpose: varchar("purpose", { length: 180 }).notNull(),
  dataScopes: text("dataScopes").notNull(),
  status: mysqlEnum("status", ["granted", "revoked"]).default("granted").notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
});

/** Per-scope, independently revocable consent. Enforcement checks these rows. */
export const consentScopes = mysqlTable("consent_scopes", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  applicantId: int("applicantId").notNull(),
  scope: varchar("scope", { length: 80 }).notNull(),
  purpose: varchar("purpose", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["granted", "revoked"]).default("granted").notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  expiresAt: timestamp("expiresAt"),
});

/** Append-only log of which department read which scope, and when. */
export const consentAccessLog = mysqlTable("consent_access_log", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  departmentId: int("departmentId"),
  scope: varchar("scope", { length: 80 }).notNull(),
  purpose: varchar("purpose", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const connectors = mysqlTable("connectors", {
  id: int("id").autoincrement().primaryKey(),
  departmentId: int("departmentId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  systemType: varchar("systemType", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["healthy", "degraded", "disabled"]).default("healthy").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(),
  successRate: int("successRate").default(99).notNull(),
});

export const integrationEvents = mysqlTable("integration_events", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId"),
  connectorId: int("connectorId"),
  direction: mysqlEnum("direction", ["outbound", "inbound"]).notNull(),
  eventType: varchar("eventType", { length: 120 }).notNull(),
  sourceSchema: varchar("sourceSchema", { length: 120 }).notNull(),
  canonicalSchema: varchar("canonicalSchema", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["processed", "failed", "retrying"]).default("processed").notNull(),
  /** Bounded, non-PII description of the exchange (never field values). */
  payloadSummary: text("payloadSummary").notNull(),
  /** Comma-separated canonical field names that were exchanged. */
  fieldNames: text("fieldNames"),
  /** SHA-256 of the normalized payload, for later verification without storing it. */
  payloadHash: varchar("payloadHash", { length: 64 }),
  attempts: int("attempts").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId"),
  actorRole: varchar("actorRole", { length: 32 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }).notNull(),
  metadata: text("metadata"),
  /** rowHash of the previous audit entry (tamper-evident chain). */
  prevHash: varchar("prevHash", { length: 64 }),
  /** SHA-256 over (prevHash + canonical entry fields). */
  rowHash: varchar("rowHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  applicationId: int("applicationId"),
  type: varchar("type", { length: 60 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const grievances = mysqlTable("grievances", {
  id: int("id").autoincrement().primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 32 }).notNull().unique(),
  raisedById: int("raisedById").notNull(),
  applicationId: int("applicationId"),
  category: varchar("category", { length: 80 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  response: text("response"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Idempotency guard so demo seeding runs exactly once per database. */
export const seedMarkers = mysqlTable("seed_markers", {
  id: int("id").autoincrement().primaryKey(),
  markerKey: varchar("markerKey", { length: 64 }).notNull().unique(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type Connector = typeof connectors.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type Consent = typeof consents.$inferSelect;
export type ConsentScope = typeof consentScopes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type VaultDocument = typeof vaultDocuments.$inferSelect;
export type Grievance = typeof grievances.$inferSelect;
