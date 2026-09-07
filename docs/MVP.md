# SetuGov MVP

SetuGov is a federated interoperability layer for business registration. A citizen submits one application, while independent departmental systems retain their own source records and exchange only normalized, purpose-limited data through connector contracts.

## User journeys

| Role | Experience | Server-side boundary |
|---|---|---|
| Citizen / business user | Start an application, attach document references, grant or revoke consent, and follow a unified timeline. | Reads and changes only owned applications and consent records. |
| Department official | Review assigned milestones, inspect integration context, add remarks, request action, route completed work, approve, or reject. | Queue and milestone updates are restricted to the official's department. |
| Platform administrator | Monitor departments, connector health, integration events, configuration, and audit history. | Administrative procedures are protected independently from the UI. |

The protected experiences are available at `/consent`, `/official`, `/admin`, and `/operations`. The overview route remains useful as a public read-only demonstration of the seeded workflow.

## Demonstrated workflow

The seeded Northstar Foods case follows `submitted → identity verification → revenue verification → address verification → department approval → final decision`. A completed milestone activates the next department step; rejection moves the application to `rejected`; a final completed step moves it to `approved`; and a request-action decision moves it to `action_required` with an official remark.

The application record stores the unified journey, not a copy of a department's source registry. Integration events retain only the metadata needed for coordination, such as direction, source and canonical schema names, status, timestamp, and a bounded payload summary.

## Privacy and audit model

Consent is stored with the application, applicant, purpose, selected scopes, status, grant timestamp, and optional revocation timestamp. The registration flow uses the scopes `identity`, `business profile`, and `registered address`. Citizens can inspect sharing history and revoke active consent. Documents store references and metadata rather than database BLOBs.

Audit entries are insert-only through the application contract. The server exposes no audit update or delete procedure, and the administrator interface is read-only. The managed TiDB deployment was tested with `CREATE TRIGGER` and returned a syntax error, indicating that database triggers are unavailable in this environment; this platform limitation is documented and the application-level invariant is retained.

## Federated connector layer

The simulated independent endpoints are:

| Source system | Endpoint | Canonical response purpose |
|---|---|---|
| Revenue e-Verify Registry | `/api/connectors/revenue/verify` | Identity verification |
| Municipal Property Ledger | `/api/connectors/municipal/address` | Registered-address verification |
| National Business Register | `/api/connectors/registry/decision` | Registry decision handoff |

They accept source-shaped JSON and return canonical responses with `sourceRecordRetained: true`. The protected `connectorExchange` procedure invokes the source-specific endpoint, records normalized exchange metadata, and writes an audit entry. No source registry record is copied into SetuGov.

## Demo access and verification

The preview can be explored without signing in using the seeded Northstar Foods presentation. To submit an application or access protected operations, use **Sign in** with the supplied authentication flow. The owner account is recognized as an administrator by the auth scaffold. The database also includes a seeded citizen demo record; official users are assigned a department through `users.role` and `users.departmentId`.

The final verification record is in [`docs/VERIFICATION.md`](./VERIFICATION.md). Run `pnpm check`, `pnpm test`, and `pnpm build` for local validation. The schema migration is in `drizzle/0001_polite_hellcat.sql`; runtime tables are created through the managed database migration path.

## Extension points

Production adapters can replace the deterministic connector handlers while preserving the canonical application contract, consent gate, event record, and audit write. A future OIDC provider can be attached behind the existing authenticated context without changing the role-specific procedures. The MVP is intentionally designed so departmental systems remain authoritative for their own source data.
