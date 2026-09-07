# SetuGov MVP verification

The final implementation was validated with `pnpm check`, `pnpm test`, and `pnpm build`. The automated suite passes four tests across authentication, canonical normalization, and admin role boundaries.

| Surface | Verification | Result |
|---|---|---|
| Citizen | Authenticated preview session temporarily rendered `/operations` as `user`; consent and sharing-history view loaded for `SG-2026-00001`. The owner role was restored afterward. | Pass |
| Department official | Authenticated preview session temporarily rendered `/operations` as `official` with department `3`; the seeded active case appeared in the server-filtered queue. The owner role was restored afterward. | Pass |
| Platform administrator | Authenticated preview session rendered `/operations` as `admin`; connector controls, event/audit summary, and editable department/connector configuration loaded. | Pass |
| Application submission | Guided form includes business fields, consent scopes, and a document-reference field; `createApplication` persists the application, references, consent, workflow route, integration event, and audit entry. | Pass by code/build validation |
| Official workflow | Review UI exposes complete-and-route, request-action, reject, and normalized exchange actions. Backend transitions the current department, activates the next workflow step, and writes routing events. | Pass by code/build validation |
| Connector simulation | Independent HTTP routes exist for revenue verification, municipal address lookup, and registry decision; connector exchange invokes the source-specific route and stores only canonical/payload-summary metadata. | Pass |
| Audit records | Admin UI is read-only for audit entries and server code exposes insert-only audit writes. A `CREATE TRIGGER` attempt was rejected by the managed TiDB deployment; this limitation is documented in `docs/MVP.md`. | Pass with platform limitation recorded |

No department source record is copied into the SetuGov database. The federated layer keeps source-shaped payloads at the simulated department endpoint and records only normalized exchange metadata needed for coordination and auditability.
