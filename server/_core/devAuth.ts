import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getDb } from "../db";
import { departments } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { isSecureRequest } from "./cookies";
import { sdk } from "./sdk";

/**
 * Development-only sign-in. The hosted Manus OAuth portal is not available
 * locally, and real OAuth logins can only ever be role `user`, so the
 * official/admin experiences would be unreachable without this.
 *
 * Gated to NODE_ENV === "development"; never registered in production.
 *
 *   GET /api/auth/dev?role=user|official|admin[&dept=REV|LAD|BR]
 */
export function registerDevAuthRoutes(app: Express) {
  if (process.env.NODE_ENV === "production") return;

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
