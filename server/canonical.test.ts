import { describe, expect, it } from "vitest";
import { fieldNamesOf, hashPayload, normalizeCanonical, runConnector, toIsoDate } from "./canonical";

describe("canonical interoperability layer", () => {
  it("converts DD/MM/YYYY source dates to ISO and leaves ISO untouched", () => {
    expect(toIsoDate("12/04/2000")).toBe("2000-04-12");
    expect(toIsoDate("12-04-2000")).toBe("2000-04-12");
    expect(toIsoDate("2000-04-12")).toBe("2000-04-12");
    expect(toIsoDate(undefined)).toBeUndefined();
  });

  it("maps a revenue source payload to the canonical identity shape", () => {
    expect(normalizeCanonical("revenue", { citizen_name: "Rahul Sharma", dob: "2000-04-12" })).toMatchObject({
      name: "Rahul Sharma",
      dateOfBirth: "2000-04-12",
    });
  });

  it("normalizes a municipal payload including its date format", () => {
    expect(normalizeCanonical("municipal", { fullName: "Rahul Sharma", date_of_birth: "12/04/2000", fullAddress: "5 MG Road" })).toMatchObject({
      name: "Rahul Sharma",
      dateOfBirth: "2000-04-12",
      registeredAddress: "5 MG Road",
    });
  });

  it("runConnector returns a canonical response and never the source record", () => {
    const out = runConnector("revenue", "verify", { citizen_name: "A", dob: "1990-01-01" });
    expect(out?.sourceRecordRetained).toBe(true);
    expect(out?.canonical).toHaveProperty("verificationStatus", "verified");
    expect(runConnector("revenue", "unknown", {})).toBeNull();
  });

  it("hashPayload is stable regardless of key order", () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it("fieldNamesOf lists canonical keys only, dropping internal _mapping", () => {
    expect(fieldNamesOf(normalizeCanonical("revenue", { citizen_name: "A", dob: "1990-01-01" })).split(","))
      .toEqual(expect.arrayContaining(["name", "dateOfBirth"]));
    expect(fieldNamesOf({ name: "x", _mapping: "y" })).toBe("name");
  });
});
