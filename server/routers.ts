import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { and, desc, eq, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  applications,
  auditLogs,
  connectors,
  consentScopes,
  consents,
  departments,
  documents,
  integrationEvents,
  serviceDepartments,
  services,
  workflowSteps,
  getDb,
  listApplications,
  applicationDetail,
  demoApplicationDetail,
  dashboardStats,
  systemHealth,
  platformAnalytics,
} from "./db";
import { grievances } from "../drizzle/schema";
import { ensureSeeded } from "./seed";
import { writeAudit, verifyAuditChain } from "./audit";
import { transitionStep, type StepAction } from "./workflow";
import { runConnector, normalizeCanonical, hashPayload, fieldNamesOf } from "./canonical";
import { assertScopeGranted } from "./consent";
import { listNotifications, markNotificationRead } from "./notify";

const officialProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user || (ctx.user.role !== "official" && ctx.user.role !== "admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Official access required" });
  }
  return next({ ctx });
});

/** An official may only see applications that touch their department. */
async function assertCanViewApplication(
  user: { id: number; role: string; departmentId: number | null },
  applicationId: number,
  applicantId: number,
) {
  if (user.role === "admin") return;
  if (user.role === "user") {
    if (applicantId !== user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Application access denied" });
    return;
  }
  // official
  if (!user.departmentId) return;
  const db = await getDb();
  if (!db) return;
  const [step] = await db
    .select({ id: workflowSteps.id })
    .from(workflowSteps)
    .where(and(eq(workflowSteps.applicationId, applicationId), eq(workflowSteps.departmentId, user.departmentId)))
    .limit(1);
  if (!step) throw new TRPCError({ code: "FORBIDDEN", message: "Application is not routed to your department" });
}

function nextApplicationNumber(existingMax: number): string {
  const seq = String(existingMax + 1).padStart(5, "0");
  return `SG-${new Date().getFullYear()}-${seq}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  platform: router({
    bootstrap: publicProcedure.query(async () => {
      await ensureSeeded();
      return { ready: true };
    }),
    health: publicProcedure.query(() => systemHealth()),
    stats: publicProcedure.query(() => dashboardStats()),
    services: publicProcedure.query(async () => {
      const db = await getDb();
      return db ? db.select().from(services).where(eq(services.status, "available")) : [];
    }),
    departments: publicProcedure.query(async () => {
      const db = await getDb();
      return db ? db.select().from(departments) : [];
    }),
    serviceDetail: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [service] = await db.select().from(services).where(eq(services.slug, input.slug));
      if (!service) return null;
      const route = await db
        .select({
          sequence: serviceDepartments.sequence,
          stepKey: serviceDepartments.stepKey,
          stepLabel: serviceDepartments.stepLabel,
          requiredScope: serviceDepartments.requiredScope,
          slaDays: serviceDepartments.slaDays,
          departmentId: departments.id,
          departmentName: departments.name,
          departmentShort: departments.shortName,
          sourceSystem: departments.sourceSystem,
        })
        .from(serviceDepartments)
        .innerJoin(departments, eq(departments.id, serviceDepartments.departmentId))
        .where(eq(serviceDepartments.serviceId, service.id))
        .orderBy(serviceDepartments.sequence);
      let requiredDocuments: string[] = [];
      try {
        requiredDocuments = JSON.parse(service.requiredDocuments);
      } catch {
        requiredDocuments = [];
      }
      return { service, route, requiredDocuments };
    }),

    applications: protectedProcedure.query(async ({ ctx }) =>
      listApplications(ctx.user.id, ctx.user.role, ctx.user.departmentId ?? undefined),
    ),
    officialQueue: officialProcedure.query(async ({ ctx }) =>
      listApplications(ctx.user.id, ctx.user.role, ctx.user.departmentId ?? undefined),
    ),
    demoDetail: publicProcedure.query(() => demoApplicationDetail()),

    detail: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const result = await applicationDetail(input.id);
      if (!result) return null;
      await assertCanViewApplication(ctx.user, result.application.id, result.application.applicantId);
      return result;
    }),

    createApplication: protectedProcedure
      .input(
        z.object({
          serviceId: z.number().optional(),
          businessName: z.string().min(2),
          businessType: z.string().min(2),
          address: z.string().min(8),
          contact: z.string().email("A valid contact email is required"),
          consentScopes: z.array(z.string()).min(1),
          documents: z
            .array(z.object({ type: z.string(), fileName: z.string(), referenceUrl: z.string().optional() }))
            .default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const service = input.serviceId
          ? (await db.select().from(services).where(eq(services.id, input.serviceId)))[0]
          : (await db.select().from(services).where(eq(services.slug, "business-registration")))[0];
        if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });

        const route = await db
          .select()
          .from(serviceDepartments)
          .where(eq(serviceDepartments.serviceId, service.id))
          .orderBy(serviceDepartments.sequence);
        if (route.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Service has no department route" });

        // Collision-safe number: derive from MAX(id), retry once on the unique key.
        let created: { id: number; applicationNumber: string } | null = null;
        for (let attempt = 0; attempt < 3 && !created; attempt++) {
          const [{ maxId } = { maxId: 0 }] = await db
            .select({ maxId: sql<number>`coalesce(max(${applications.id}), 0)` })
            .from(applications);
          const number = nextApplicationNumber(Number(maxId) + attempt);
          try {
            await db.insert(applications).values({
              applicationNumber: number,
              applicantId: ctx.user.id,
              serviceId: service.id,
              businessName: input.businessName,
              businessType: input.businessType,
              address: input.address,
              contact: input.contact,
              status: "submitted",
              currentDepartmentId: route[0].departmentId,
              submittedAt: new Date(),
            });
            const [row] = await db.select().from(applications).where(eq(applications.applicationNumber, number));
            created = { id: row.id, applicationNumber: number };
          } catch (err) {
            if (attempt === 2) throw err;
          }
        }
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not allocate application number" });

        await db.insert(workflowSteps).values(
          route.map((r, i) => ({
            applicationId: created!.id,
            departmentId: r.departmentId,
            stepKey: r.stepKey,
            label: r.stepLabel,
            sequence: r.sequence,
            status: i === 0 ? ("in_progress" as const) : ("pending" as const),
            responsibleRole: "Department official",
            requiredScope: r.requiredScope ?? null,
            startedAt: i === 0 ? new Date() : null,
            slaDueAt: i === 0 ? new Date(Date.now() + r.slaDays * 86_400_000) : null,
          })),
        );

        if (input.documents.length) {
          await db.insert(documents).values(
            input.documents.map(d => ({
              applicationId: created!.id,
              documentType: d.type,
              fileName: d.fileName,
              referenceUrl: d.referenceUrl,
              status: "referenced" as const,
            })),
          );
        }

        const purpose = `${service.name} verification`;
        await db.insert(consents).values({
          applicationId: created.id,
          applicantId: ctx.user.id,
          purpose,
          dataScopes: JSON.stringify(input.consentScopes),
          status: "granted",
        });
        await db.insert(consentScopes).values(
          input.consentScopes.map(scope => ({
            applicationId: created!.id,
            applicantId: ctx.user.id,
            scope,
            purpose,
            status: "granted" as const,
          })),
        );

        await db.insert(integrationEvents).values({
          applicationId: created.id,
          direction: "outbound",
          eventType: "application.submitted",
          sourceSchema: "citizen.businessRegistration.v1",
          canonicalSchema: "setugov.application.v1",
          fieldNames: "businessName,businessType,address,contact",
          payloadSummary: "Validated, consent-gated, normalized, and routed to the first department",
          status: "processed",
        });

        await writeAudit(ctx.user.id, ctx.user.role, "application.submitted", "application", created.applicationNumber, "Purpose-limited consent recorded per scope");
        return { id: created.id, applicationNumber: created.applicationNumber };
      }),

    updateConsent: protectedProcedure
      .input(z.object({ applicationId: z.number(), scope: z.string().optional(), status: z.enum(["granted", "revoked"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [app] = await db
          .select()
          .from(applications)
          .where(and(eq(applications.id, input.applicationId), eq(applications.applicantId, ctx.user.id)));
        if (!app) throw new TRPCError({ code: "FORBIDDEN", message: "Application access denied" });

        const setFields = {
          status: input.status,
          revokedAt: input.status === "revoked" ? new Date() : null,
          grantedAt: input.status === "granted" ? new Date() : undefined,
        };
        const whereClause = input.scope
          ? and(eq(consentScopes.applicationId, input.applicationId), eq(consentScopes.scope, input.scope))
          : eq(consentScopes.applicationId, input.applicationId);
        await db.update(consentScopes).set(setFields).where(whereClause);

        // Keep the legacy purpose record roughly in sync for display.
        if (!input.scope) {
          await db
            .update(consents)
            .set({ status: input.status, revokedAt: input.status === "revoked" ? new Date() : null })
            .where(eq(consents.applicationId, input.applicationId));
        }

        await writeAudit(
          ctx.user.id,
          ctx.user.role,
          `consent.${input.status}`,
          "consent_scope",
          `${input.applicationId}${input.scope ? `:${input.scope}` : ""}`,
        );
        return { success: true };
      }),

    connectorExchange: officialProcedure
      .input(
        z.object({
          applicationId: z.number(),
          connectorId: z.number(),
          source: z.enum(["revenue", "municipal"]),
          payload: z.record(z.string(), z.string()),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const requiredScope = input.source === "revenue" ? "identity" : "registered address";
        await assertScopeGranted(input.applicationId, requiredScope, {
          departmentId: ctx.user.departmentId,
          purpose: `${input.source} verification exchange`,
        });

        const action = input.source === "revenue" ? "verify" : "address";
        const connectorResult = runConnector(input.source, action, input.payload);
        const normalized = connectorResult?.canonical ?? normalizeCanonical(input.source, input.payload);

        // Store field names + a hash only — never the values.
        await db.insert(integrationEvents).values({
          applicationId: input.applicationId,
          connectorId: input.connectorId,
          direction: "inbound",
          eventType: "connector.normalized",
          sourceSchema: `${input.source}.source.v1`,
          canonicalSchema: "setugov.canonical.v1",
          fieldNames: fieldNamesOf(normalized as Record<string, unknown>),
          payloadHash: hashPayload(normalized),
          payloadSummary: `Normalized ${input.source} payload to canonical shape; source record retained by the department`,
          status: "processed",
        });

        await writeAudit(
          ctx.user.id,
          ctx.user.role,
          "connector.exchange",
          "integration_event",
          String(input.applicationId),
          "Independent source record remains with department; SetuGov stored only field names + hash",
        );
        return { fields: fieldNamesOf(normalized as Record<string, unknown>), mapping: (normalized as Record<string, unknown>)._mapping ?? null };
      }),

    updateStep: officialProcedure
      .input(
        z.object({
          stepId: z.number(),
          status: z.enum(["in_progress", "completed", "blocked", "rejected"]),
          remarks: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const map: Record<string, StepAction> = {
          in_progress: "start",
          completed: "complete",
          blocked: "request_action",
          rejected: "reject",
        };
        const result = await transitionStep(
          { id: ctx.user.id, role: ctx.user.role, departmentId: ctx.user.departmentId ?? null },
          input.stepId,
          map[input.status],
          input.remarks,
        );

        if (result.stepStatus === "completed" && result.nextDepartmentId) {
          const db = await getDb();
          if (db) {
            const [step] = await db.select().from(workflowSteps).where(eq(workflowSteps.id, input.stepId));
            await db.insert(integrationEvents).values({
              applicationId: step.applicationId,
              direction: "outbound",
              eventType: "workflow.routed",
              sourceSchema: "setugov.workflow.v1",
              canonicalSchema: "department.task.v1",
              fieldNames: "applicationRef,step",
              payloadSummary: `Routed to department ${result.nextDepartmentId} without copying source records`,
              status: "processed",
            });
          }
        }
        return { success: true, nextDepartmentId: result.nextDepartmentId, finalStatus: result.finalStatus };
      }),

    normalizePreview: publicProcedure
      .input(z.object({ source: z.enum(["revenue", "municipal"]), payload: z.record(z.string(), z.string()) }))
      .mutation(({ input }) => normalizeCanonical(input.source, input.payload)),

    notifications: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    markNotificationRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(ctx.user.id, input.id);
        return { success: true };
      }),

    myGrievances: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(grievances).where(eq(grievances.raisedById, ctx.user.id)).orderBy(desc(grievances.createdAt));
    }),
    fileGrievance: protectedProcedure
      .input(
        z.object({
          category: z.string().min(2),
          subject: z.string().min(4),
          body: z.string().min(10),
          applicationId: z.number().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [{ maxId } = { maxId: 0 }] = await db.select({ maxId: sql<number>`coalesce(max(${grievances.id}), 0)` }).from(grievances);
        const ticketNumber = `GRV-${new Date().getFullYear()}-${String(Number(maxId) + 1).padStart(5, "0")}`;
        await db.insert(grievances).values({
          ticketNumber,
          raisedById: ctx.user.id,
          applicationId: input.applicationId ?? null,
          category: input.category,
          subject: input.subject,
          body: input.body,
        });
        await writeAudit(ctx.user.id, ctx.user.role, "grievance.filed", "grievance", ticketNumber);
        return { ticketNumber };
      }),

    // ---- admin ----
    setConnectorStatus: adminProcedure
      .input(z.object({ connectorId: z.number(), status: z.enum(["healthy", "degraded", "disabled"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(connectors).set({ status: input.status, lastCheckedAt: new Date() }).where(eq(connectors.id, input.connectorId));
        await writeAudit(ctx.user.id, ctx.user.role, "connector.status_changed", "connector", String(input.connectorId), input.status);
        return { success: true };
      }),
    updateConnector: adminProcedure
      .input(z.object({ connectorId: z.number(), name: z.string().min(2), endpoint: z.string().min(3), systemType: z.string().min(2) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(connectors).set({ name: input.name, endpoint: input.endpoint, systemType: input.systemType }).where(eq(connectors.id, input.connectorId));
        await writeAudit(ctx.user.id, ctx.user.role, "connector.configured", "connector", String(input.connectorId), `${input.name} · ${input.endpoint}`);
        return { success: true };
      }),
    updateDepartment: adminProcedure
      .input(z.object({ departmentId: z.number(), name: z.string().min(2), sourceSystem: z.string().min(2) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(departments).set({ name: input.name, sourceSystem: input.sourceSystem }).where(eq(departments.id, input.departmentId));
        await writeAudit(ctx.user.id, ctx.user.role, "department.configured", "department", String(input.departmentId), `${input.name} · ${input.sourceSystem}`);
        return { success: true };
      }),
    assignRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "official", "admin"]), departmentId: z.number().nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db
          .update(users)
          .set({ role: input.role, departmentId: input.role === "official" ? input.departmentId ?? null : null })
          .where(eq(users.id, input.userId));
        await writeAudit(ctx.user.id, ctx.user.role, "user.role_assigned", "user", String(input.userId), `${input.role}${input.departmentId ? ` · dept ${input.departmentId}` : ""}`);
        return { success: true };
      }),
    retryEvent: adminProcedure
      .input(z.object({ eventId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [event] = await db.select().from(integrationEvents).where(eq(integrationEvents.id, input.eventId));
        if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
        await db
          .update(integrationEvents)
          .set({ status: "processed", attempts: (event.attempts ?? 1) + 1 })
          .where(eq(integrationEvents.id, input.eventId));
        await writeAudit(ctx.user.id, ctx.user.role, "integration.retry", "integration_event", String(input.eventId), `attempt ${(event.attempts ?? 1) + 1}`);
        return { success: true };
      }),
    verifyAudit: adminProcedure.query(() => verifyAuditChain()),
    analytics: adminProcedure.query(() => platformAnalytics()),
    grievances: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(grievances).orderBy(desc(grievances.createdAt)).limit(100);
    }),
    updateGrievance: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["open", "in_progress", "resolved", "closed"]), response: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(grievances).set({ status: input.status, response: input.response }).where(eq(grievances.id, input.id));
        await writeAudit(ctx.user.id, ctx.user.role, `grievance.${input.status}`, "grievance", String(input.id), input.response ?? null);
        return { success: true };
      }),
    users: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(users).orderBy(desc(users.createdAt));
    }),
    adminOverview: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { departments: [], connectors: [], audits: [], events: [], auditChain: null };
      const [depts, conns, audits, events, auditChain] = await Promise.all([
        db.select().from(departments),
        db.select().from(connectors),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(30),
        db.select().from(integrationEvents).orderBy(desc(integrationEvents.createdAt)).limit(20),
        verifyAuditChain(),
      ]);
      return { departments: depts, connectors: conns, audits, events, auditChain };
    }),
  }),
});

export type AppRouter = typeof appRouter;
