# SetuGov — MVP

**Problem statement:** SIH26129 (Government of Maharashtra) — *system integration and
interoperability among government digital platforms; fragmented service delivery.*

SetuGov is a coordination and governance layer over independent departmental systems.
A citizen applies once; departments retain their own source records and exchange only
normalised, purpose-limited data through connector contracts.

## Roles and access

| Role | Experience | Server-side boundary |
|---|---|---|
| Citizen (`user`) | Service directory, guided application wizard, unified timeline, per-scope consent ledger + access log, document vault, grievances, notifications. | Reads/changes only own applications, consent scopes, vault and grievances. |
| Department official (`official`) | Department work queue (every case ever routed to the department), milestone decisions (complete / request action / reject), in-process connector normalisation. | Queue and milestone updates restricted to the official's department; case reads bounded to the department. |
| Platform administrator (`admin`) | Analytics (status split, per-department workload/throughput, SLA breaches), connector + department configuration, connector onboarding, failed-event retry, user/role assignment, grievance handling, audit-chain verification. | Admin procedures are role-checked independently of the UI. |

Local development exposes `GET /api/auth/dev?role=user|official|admin[&dept=REV|LAD|BR]`
(only when `NODE_ENV=development`) because the hosted OAuth portal is not available
locally and real logins are always role `user`.

## Interoperability model

- **Canonical layer** (`server/canonical.ts`): a source-shaped payload is mapped to the
  shared canonical shape. SetuGov stores only the canonical **field names** plus a
  **SHA-256 hash** of the normalised payload — never the values.
- **Adapters**: Revenue e-Verify, Municipal Property Ledger, National Business Register,
  DigiLocker, Aadhaar e-KYC, Income Tax PAN, GST Network. The `ADAPTERS` registry drives
  the "onboard a department" wizard and a published **OpenAPI 3 contract**
  (`platform.connectorSpec`).
- Simulated department endpoints live at `/api/connectors/:system/:action` and are also
  invoked in-process by the `connectorExchange` procedure, so the HTTP route and the
  tRPC path can never drift.
- Each exchange first calls `assertScopeGranted()`; a scope that is not actively granted
  raises `FORBIDDEN`, and every successful check is written to an append-only
  `consent_access_log` the citizen can inspect.

## Workflow

`server/workflow.ts` holds a single `transitionStep()` state machine:
`start / complete / request_action / reject`. Completing a step activates the next
department step (with an SLA due date), routes the application, and emits a
`workflow.routed` integration event; the last step approves; a rejection is terminal;
"request action" moves the application to `action_required` without clearing an existing
completion timestamp. Every transition writes an audit entry and a citizen notification.

## Consent, audit, privacy

- Consent is stored per scope (`consent_scopes`), independently revocable, with optional
  expiry. The legacy `consents` purpose record is kept in sync for display.
- The audit log is **hash-chained**: each row stores `prevHash` and
  `rowHash = sha256(prevHash + canonical fields)` over second-precision timestamps.
  `platform.verifyAudit` walks the chain and reports the first broken row;
  `platform.auditProof` returns the full chain plus the verification result for
  download. The managed database has no trigger support, so immutability is enforced at
  the application contract (insert-only; no update/delete procedure).
- Documents are stored as references/metadata, never as database BLOBs. The document
  vault (`vault_documents`) lets a citizen save a reference once and reuse it.

## Services

Seeded services: Business Registration, Shops & Establishment Registration, Trade
Licence. Each has an ordered department route in `service_departments` with a step key,
label, required consent scope and SLA in days.

## Frontend

React 19 + Vite + tRPC + TanStack Query, Tailwind v4. `next-themes` provides
light / dark / system; `react-i18next` provides English, हिन्दी and मराठी (with the
other Eighth Schedule languages listed in the selector and falling back to English).
The visual system follows GIGW / india.gov.in conventions: tricolour accent rule,
navy-teal identification bar with skip link / screen-reader link / A-·A·A+ text sizing,
bilingual emblem lockup masthead, solid primary navigation, breadcrumb strip,
announcements ticker, boxy hairline panels and a structured footer.

## Local validation

```
pnpm install
cp .env.example .env          # points at a local MySQL/TiDB
pnpm db:push                  # or: drizzle-kit migrate
pnpm check && pnpm test && pnpm build
pnpm dev
```

Migration: `drizzle/0000_setugov_baseline.sql` (consolidated; migrates a fresh database
end to end). Verification record: [`docs/VERIFICATION.md`](./VERIFICATION.md).
