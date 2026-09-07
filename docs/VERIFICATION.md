# SetuGov — verification

Automated:

- `pnpm check` — tsc, clean
- `pnpm test` — 10 DB-free unit tests (auth, canonical normalisation, connector
  contract, admin role boundaries); the DB-backed suite is skipped
- `pnpm build` — client + server bundle
- `pnpm test:e2e` (needs a `DATABASE_URL`) — 8 tests driving the full journey
  against a real database:

  ```
  DATABASE_URL='mysql://setugov:setugov@127.0.0.1:3307/setugov_e2e' pnpm exec drizzle-kit migrate
  DATABASE_URL='mysql://setugov:setugov@127.0.0.1:3307/setugov_e2e' pnpm test:e2e
  ```

  Covered: citizen submit + routing; cross-tenant read denied; department queue
  visibility; connector exchange blocked while a consent scope is withdrawn, then
  allowed; integration event stores only field names + a SHA-256 hash (asserts no
  PII in the row); milestone completion routing through to approval; audit-chain
  integrity + analytics after approval; citizen-visible access log.

All green.

Manual walkthrough against a local MySQL 8.4 database, exercised through the dev
sign-in route:

| Surface | Check | Result |
|---|---|---|
| Cold start | 10 concurrent first-load requests during seeding | Pass — idempotent boot-time seed; no duplicate-key errors (previously returned a 500) |
| Health | `platform.health` | Pass — `{database:"ok", seeded:true}` |
| Citizen | Service directory → service detail (department journey, SLAs, scopes) → 3-step apply wizard → submit | Pass — application created (`SG-2026-#####`, no collision with the seeded case) |
| Citizen | Consent ledger: withdraw a scope, then a connector exchange needing it | Pass — exchange rejected with `FORBIDDEN`; access log records granted checks |
| Citizen | Document vault add / reuse in apply wizard; grievance file + list | Pass |
| Official | Department queue shows cases routed to the department (incl. onward-routed); milestone complete routes to next department | Pass |
| Official | Connector-adapter picker (Revenue / Municipal / DigiLocker / Aadhaar / PAN / GSTN) → normalise exchange | Pass — `integration_events` stores canonical field names + SHA-256 only, no PII |
| Admin | Analytics: status split, per-department open/completed/avg-hours, SLA breach count | Pass |
| Admin | Audit-chain integrity: verified; editing an `audit_logs` row directly in MySQL | Pass — `verifyAudit` reports `ok:false, brokenAtId:1` |
| Admin | Connector onboarding form; `Download OpenAPI contract`; `Download verification report` | Pass — endpoints return valid JSON |
| Admin | Assign a user the `official` role + department | Pass |
| Themes | light / dark / system via `next-themes` | Pass — both palettes verified in-browser |
| i18n | English / हिन्दी / मराठी across the citizen and officer surfaces | Pass — selector switches live; info/legal pages fall back to English |
| Migration | `drizzle-kit migrate` against an empty database | Pass — all 18 tables created |

No department source record is copied into SetuGov. The federated layer keeps
source-shaped payloads at the (simulated) department endpoint and stores only the
coordination metadata and hashes needed for routing and auditability.
