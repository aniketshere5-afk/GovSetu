import { createHash } from "node:crypto";

/**
 * Canonical interoperability layer.
 *
 * Independent department systems speak their own source schemas. SetuGov never
 * stores their records — it maps a source-shaped payload to the shared canonical
 * shape, keeps only the field *names* plus a hash, and lets the department retain
 * the authoritative values.
 */

export type ConnectorSystem = "revenue" | "municipal" | "registry";

export type CanonicalResult = {
  sourceSystem: string;
  canonical: Record<string, unknown>;
  sourceRecordRetained: true;
};

/** Deterministic SHA-256 over a stable JSON serialization. */
export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** DD/MM/YYYY -> YYYY-MM-DD; passes through anything already ISO-ish. */
export function toIsoDate(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const m = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return trimmed;
}

/**
 * Map a source payload to the canonical shape. Pure, no persistence.
 * `_mapping` documents the transform for the UI and is not stored.
 */
export function normalizeCanonical(
  source: "revenue" | "municipal",
  payload: Record<string, string>,
): Record<string, unknown> {
  if (source === "revenue") {
    return {
      name: payload.citizen_name ?? payload.fullName,
      dateOfBirth: toIsoDate(payload.dob ?? payload.date_of_birth),
      _mapping: "citizen_name → name · dob → dateOfBirth",
    };
  }
  return {
    name: payload.fullName ?? payload.citizen_name,
    dateOfBirth: toIsoDate(payload.date_of_birth ?? payload.dob),
    registeredAddress: payload.fullAddress ?? payload.address,
    _mapping: "fullName → name · date_of_birth → dateOfBirth · fullAddress → registeredAddress",
  };
}

/**
 * In-process stand-in for an independent department system. Returns only a
 * canonical response; the "source record" never leaves this function.
 * Replaces the previous HTTP self-call (which broke when the server picked a
 * non-default port).
 */
export function runConnector(
  system: string,
  action: string,
  payload: Record<string, string>,
): CanonicalResult | null {
  if (system === "revenue" && action === "verify") {
    return {
      sourceSystem: "Revenue e-Verify Registry",
      canonical: {
        verificationStatus: "verified",
        name: payload.citizen_name || payload.fullName,
        dateOfBirth: toIsoDate(payload.dob || payload.date_of_birth),
      },
      sourceRecordRetained: true,
    };
  }
  if (system === "municipal" && action === "address") {
    return {
      sourceSystem: "Municipal Property Ledger",
      canonical: {
        verificationStatus: "verified",
        registeredAddress: payload.fullAddress || payload.address,
      },
      sourceRecordRetained: true,
    };
  }
  if (system === "registry" && action === "decision") {
    return {
      sourceSystem: "National Business Register",
      canonical: { decision: "pending_review", registrationNumber: null },
      sourceRecordRetained: true,
    };
  }
  return null;
}

/** Field names only — never values — for an integration-event record. */
export function fieldNamesOf(payload: Record<string, unknown>): string {
  return Object.keys(payload)
    .filter(k => !k.startsWith("_"))
    .join(",");
}
