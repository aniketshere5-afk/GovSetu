import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = (role: "user" | "official" | "admin" = "user"): TrpcContext => ({
  user: { id: 9, openId: "test-user", name: "Test User", email: "test@example.com", loginMethod: "test", role, departmentId: role === "official" ? 1 : null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("SetuGov interoperability contract", () => {
  it("normalizes a revenue payload into the canonical identity shape", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.platform.normalizePreview({ source: "revenue", payload: { citizen_name: "Rahul Sharma", dob: "2000-04-12" } })).resolves.toMatchObject({ name: "Rahul Sharma", dateOfBirth: "2000-04-12" });
  });
  it("normalizes a municipal payload and converts the source date format", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.platform.normalizePreview({ source: "municipal", payload: { fullName: "Rahul Sharma", date_of_birth: "12/04/2000" } })).resolves.toMatchObject({ name: "Rahul Sharma", dateOfBirth: "2000-04-12" });
  });
  it("does not expose admin procedures to a citizen context", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.platform.adminOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
