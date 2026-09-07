import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, upsertUser, getUserByOpenId } from "./db";
import { ensureSeeded } from "./seed";
import { departments, services, workflowSteps, integrationEvents } from "../drizzle/schema";
import type { User } from "../drizzle/schema";

/**
 * Full citizen -> official -> admin journey against a real database.
 *
 * Runs only when a DATABASE_URL is present (set by `pnpm test:e2e`); the default
 * `pnpm test` skips it so the unit suite stays DB-free.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const run = HAS_DB ? describe : describe.skip;

function ctxFor(user: User): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie() {}, cookie() {} } as unknown as TrpcContext["res"],
  };
}

async function makeUser(openId: string, role: "user" | "official" | "admin", departmentId?: number): Promise<User> {
  await upsertUser({ openId, name: openId, email: `${openId}@e2e.test`, loginMethod: "e2e", role, departmentId: departmentId ?? null });
  const u = await getUserByOpenId(openId);
  if (!u) throw new Error(`could not create ${openId}`);
  return u;
}

run("SetuGov end-to-end journey", () => {
  const tag = `e2e-${Date.now()}`;
  let citizen: User, other: User, admin: User;
  let officialByDept: Record<number, User> = {};
  let deptIds: Record<string, number> = {};
  let serviceId = 0;
  let appId = 0;
  let appNumber = "";

  beforeAll(async () => {
    await ensureSeeded();
    const db = await getDb();
    if (!db) throw new Error("no db");
    const depts = await db.select().from(departments);
    deptIds = Object.fromEntries(depts.map(d => [d.code, d.id]));
    const [svc] = await db.select().from(services).where(eq(services.slug, "business-registration"));
    serviceId = svc.id;

    citizen = await makeUser(`${tag}-citizen`, "user");
    other = await makeUser(`${tag}-other`, "user");
    admin = await makeUser(`${tag}-admin`, "admin");
    for (const code of ["REV", "LAD", "BR"]) {
      officialByDept[deptIds[code]] = await makeUser(`${tag}-off-${code}`, "official", deptIds[code]);
    }
  });

  it("citizen submits an application and it is routed to the first department", async () => {
    const caller = appRouter.createCaller(ctxFor(citizen));
    const res = await caller.platform.createApplication({
      serviceId,
      businessName: `${tag} Traders`,
      businessType: "Private Limited",
      address: "5 MG Road, Pune 411001",
      contact: "founder@e2e.test",
      consentScopes: ["identity", "registered address", "business profile"],
      documents: [],
    });
    appId = res.id;
    appNumber = res.applicationNumber;
    expect(appNumber).toMatch(/^SG-\d{4}-\d{5}$/);

    const mine = await caller.platform.applications();
    expect(mine.some(a => a.id === appId)).toBe(true);

    const detail = await caller.platform.detail({ id: appId });
    expect(detail?.application.status).toBe("submitted");
    expect(detail?.steps[0].status).toBe("in_progress");
    expect(detail?.scopes.map(s => s.scope).sort()).toEqual(["business profile", "identity", "registered address"]);
  });

  it("another citizen cannot read the application", async () => {
    const caller = appRouter.createCaller(ctxFor(other));
    await expect(caller.platform.detail({ id: appId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("the first department sees the case in its queue", async () => {
    const caller = appRouter.createCaller(ctxFor(officialByDept[deptIds.REV]));
    const queue = await caller.platform.officialQueue();
    expect(queue.some(a => a.id === appId)).toBe(true);
  });

  it("a connector exchange is blocked while its consent scope is withdrawn", async () => {
    const citizenCaller = appRouter.createCaller(ctxFor(citizen));
    await citizenCaller.platform.updateConsent({ applicationId: appId, scope: "identity", status: "revoked" });

    const official = appRouter.createCaller(ctxFor(officialByDept[deptIds.REV]));
    await expect(
      official.platform.connectorExchange({
        applicationId: appId,
        connectorId: 1,
        source: "revenue",
        payload: { citizen_name: "Test", dob: "1990-01-01" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await citizenCaller.platform.updateConsent({ applicationId: appId, scope: "identity", status: "granted" });
  });

  it("a granted exchange stores only canonical field names + a hash, no PII", async () => {
    const official = appRouter.createCaller(ctxFor(officialByDept[deptIds.REV]));
    await official.platform.connectorExchange({
      applicationId: appId,
      connectorId: 1,
      source: "revenue",
      payload: { citizen_name: "Priya Patil", dob: "1991-02-03" },
    });
    const db = await getDb();
    const rows = await db!.select().from(integrationEvents).where(eq(integrationEvents.applicationId, appId));
    const normalized = rows.find(r => r.eventType === "connector.normalized");
    expect(normalized).toBeTruthy();
    expect(normalized!.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(normalized!.fieldNames).toContain("name");
    expect(JSON.stringify(normalized)).not.toContain("Priya Patil");
  });

  it("completing each milestone routes the application to approval", async () => {
    const db = await getDb();
    for (const code of ["REV", "LAD", "BR"]) {
      const official = appRouter.createCaller(ctxFor(officialByDept[deptIds[code]]));
      const steps = await db!.select().from(workflowSteps).where(eq(workflowSteps.applicationId, appId));
      const active = steps.find(s => s.status === "in_progress" && s.departmentId === deptIds[code]);
      expect(active, `an in-progress step for ${code}`).toBeTruthy();
      const r = await official.platform.updateStep({ stepId: active!.id, status: "completed", remarks: `${code} cleared` });
      if (code === "BR") expect(r.finalStatus).toBe("approved");
    }
    const citizenCaller = appRouter.createCaller(ctxFor(citizen));
    const detail = await citizenCaller.platform.detail({ id: appId });
    expect(detail?.application.status).toBe("approved");
    expect(detail?.application.decidedAt).toBeTruthy();
  });

  it("the audit chain stays intact and analytics reflect the approval", async () => {
    const adminCaller = appRouter.createCaller(ctxFor(admin));
    const chain = await adminCaller.platform.verifyAudit();
    expect(chain.ok).toBe(true);
    const analytics = await adminCaller.platform.analytics();
    expect(analytics.byStatus.find(s => s.status === "approved")!.count).toBeGreaterThanOrEqual(1);
  });

  it("citizen can see the data-sharing access log for their application", async () => {
    const caller = appRouter.createCaller(ctxFor(citizen));
    const detail = await caller.platform.detail({ id: appId });
    expect(detail!.accessLog.some(l => l.scope === "identity")).toBe(true);
  });
});
