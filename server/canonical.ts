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
  if (system === "digilocker" && action === "fetch") {
    return {
      sourceSystem: "DigiLocker",
      canonical: {
        verificationStatus: "verified",
        documentType: payload.doc_type || "identity",
        issuer: payload.issuer || "UIDAI",
        name: payload.name,
      },
      sourceRecordRetained: true,
    };
  }
  if (system === "aadhaar" && action === "ekyc") {
    return {
      sourceSystem: "Aadhaar e-KYC (UIDAI)",
      canonical: {
        verificationStatus: "verified",
        name: payload.name,
        dateOfBirth: toIsoDate(payload.dob),
        addressVerified: Boolean(payload.address),
      },
      sourceRecordRetained: true,
    };
  }
  if (system === "pan" && action === "verify") {
    return {
      sourceSystem: "Income Tax PAN Registry",
      canonical: {
        verificationStatus: payload.pan ? "verified" : "not_found",
        panLast4: payload.pan ? String(payload.pan).slice(-4) : null,
        name: payload.name,
      },
      sourceRecordRetained: true,
    };
  }
  if (system === "gstn" && action === "verify") {
    return {
      sourceSystem: "Goods & Services Tax Network",
      canonical: {
        verificationStatus: payload.gstin ? "active" : "not_found",
        gstinLast4: payload.gstin ? String(payload.gstin).slice(-4) : null,
        legalName: payload.legal_name,
      },
      sourceRecordRetained: true,
    };
  }
  return null;
}

/**
 * Registry of connector adapters SetuGov can normalise against. Drives the
 * "onboard a department" wizard and the published OpenAPI contract.
 */
export const ADAPTERS = [
  { system: "revenue", action: "verify", label: "Revenue e-Verify", sourceFields: ["citizen_name", "dob"], canonicalFields: ["name", "dateOfBirth", "verificationStatus"] },
  { system: "municipal", action: "address", label: "Municipal Property Ledger", sourceFields: ["fullAddress"], canonicalFields: ["registeredAddress", "verificationStatus"] },
  { system: "registry", action: "decision", label: "National Business Register", sourceFields: ["applicationRef"], canonicalFields: ["decision", "registrationNumber"] },
  { system: "digilocker", action: "fetch", label: "DigiLocker", sourceFields: ["doc_type", "issuer", "name"], canonicalFields: ["documentType", "issuer", "name", "verificationStatus"] },
  { system: "aadhaar", action: "ekyc", label: "Aadhaar e-KYC (UIDAI)", sourceFields: ["name", "dob", "address"], canonicalFields: ["name", "dateOfBirth", "addressVerified", "verificationStatus"] },
  { system: "pan", action: "verify", label: "Income Tax PAN", sourceFields: ["pan", "name"], canonicalFields: ["panLast4", "name", "verificationStatus"] },
  { system: "gstn", action: "verify", label: "GST Network", sourceFields: ["gstin", "legal_name"], canonicalFields: ["gstinLast4", "legalName", "verificationStatus"] },
] as const;

/** Minimal OpenAPI 3 document describing the canonical connector contract. */
export function connectorOpenApiSpec() {
  const paths: Record<string, unknown> = {};
  for (const a of ADAPTERS) {
    paths[`/api/connectors/${a.system}/${a.action}`] = {
      post: {
        summary: `${a.label} — normalise a source payload to the SetuGov canonical shape`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: Object.fromEntries(a.sourceFields.map(f => [f, { type: "string" }])),
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Canonical response; the department retains the source record.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sourceSystem: { type: "string" },
                    sourceRecordRetained: { type: "boolean", enum: [true] },
                    canonical: {
                      type: "object",
                      properties: Object.fromEntries(a.canonicalFields.map(f => [f, {}])),
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "SetuGov Connector Contract",
      version: "1.0.0",
      description:
        "Every department connector accepts a source-shaped JSON payload and returns a canonical response. SetuGov stores only canonical field names and a payload hash — never source values.",
    },
    paths,
  };
}

/** Field names only — never values — for an integration-event record. */
export function fieldNamesOf(payload: Record<string, unknown>): string {
  return Object.keys(payload)
    .filter(k => !k.startsWith("_"))
    .join(",");
}
