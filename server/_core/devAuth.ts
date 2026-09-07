import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getDb } from "../db";
import { departments } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { isSecureRequest } from "./cookies";
import { DEMO_MODE } from "./env";
import { sdk } from "./sdk";

/**
 * Role sign-in without the hosted OAuth portal. Real OAuth logins can only ever
 * be role `user`, so the official/admin experiences would otherwise be
 * unreachable in local dev and in a standalone demo deployment.
 *
 * Registered when NODE_ENV !== "production", OR when DEMO_AUTH="1" is set
 * explicitly (used for the hosted SIH demo, which has only seeded sample data).
 * Never enable DEMO_AUTH on a deployment holding real data.
 *
 *   GET /api/auth/dev?role=user|official|admin[&dept=REV|LAD|BR]
 */
export function registerDevAuthRoutes(app: Express) {
  // Enabled in local dev, or on any deployment with no OAuth portal configured
  // (a standalone demo), or when DEMO_AUTH=1 is set explicitly.
  const enabled = process.env.NODE_ENV !== "production" || DEMO_MODE;
  if (!enabled) return;

  app.get("/api/auth/dev", async (req: Request, res: Response) => {
    const role = String(req.query.role ?? "user");
    if (!["user", "official", "admin"].includes(role)) {
      res.status(400).json({ error: "role must be user | official | admin" });
      return;
    }

    let departmentId: number | null = null;
    if (role === "official") {
      const code = String(req.query.dept ?? "LAD");
      const conn = await getDb();
      if (conn) {
        const [dept] = await conn.select().from(departments).where(eq(departments.code, code)).limit(1);
        departmentId = dept?.id ?? null;
      }
    }

    const openId = `dev-${role}`;
    const name = { user: "Dev Citizen", official: "Dev Official", admin: "Dev Admin" }[role]!;

    await db.upsertUser({
      openId,
      name,
      email: `${openId}@dev.setugov`,
      loginMethod: "dev",
      role: role as "user" | "official" | "admin",
      departmentId,
      lastSignedIn: new Date(),
    });

    const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
    // Local dev is plain http, so SameSite=None (which needs Secure) would be
    // rejected by the browser. Use Lax here; production OAuth keeps its own opts.
    const secure = isSecureRequest(req);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: secure ? "none" : "lax",
      secure,
      maxAge: ONE_YEAR_MS,
    });
    res.redirect(302, "/");
  });
}
