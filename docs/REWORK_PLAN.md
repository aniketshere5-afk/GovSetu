# SetuGov — Rework Plan (SIH26129)

**Problem statement:** SIH26129 · Government of Maharashtra · *"System integration and
interoperability among government digital platforms, resulting in fragmented service
delivery"* · Theme: Smart Automation.

**Frontend direction (from user):** must read as an official Government of India portal
(GIGW / india.gov.in anchor), take cues from existing single-window portals, support
**light / dark / system** themes, and offer an **Indian-language selector**.

---

## 0. Working setup (this session)

- Local MySQL 8.4 in Docker on `:3307` (`setugov` / `setugov`), because there is no
  bundled DB and every feature silently no-ops without one.
- `.env` created from a new `.env.example`.
- Dev-only sign-in route so the `official` / `admin` experiences are reachable without
  the hosted OAuth portal.
- Baseline captured with `pnpm check` + `pnpm test` before any change.

---

## 1. Bugs to fix

### P0 — blocks install / first paint / core demo
| # | Bug | Fix |
|---|-----|-----|
| 1 | `seedDemoData()` runs on every public request and is not atomic; parallel first-load queries race and the second seed crashes on the `SG-2026-00001` unique key. | Seed once at server boot behind an advisory lock / `seeded` marker row; make every insert idempotent (`INSERT … ON DUPLICATE KEY`). Router procedures stop calling `seedDemoData()`. |
| 2 | `connectorExchange` self-fetches `http://127.0.0.1:${process.env.PORT||3000}` but the server auto-picks another port via `findAvailablePort()`. | Call the connector logic in-process (extract to `server/connectors.ts`); no HTTP round-trip. |
| 3 | Application number `SG-${year}-${count+1}` races → duplicate unique key on concurrent submit. | Generate inside a transaction using `MAX(id)` + a short random suffix; retry once on duplicate. |
| 4 | Real OAuth users can never become `official` / `admin`; those roles exist only on seed rows that are never logged into. | Admin screen to set a user's role + department. Dev-only sign-in route for local/demo (`NODE_ENV==="development"` gate). Optional email→role seed map. |
| 5 | `wouter` patch targets `3.7.1` while `package.json` pins `^3.3.5` — only safe with `--frozen-lockfile`. | Pin `wouter` to `3.7.1` so any install path works. |

### P1 — contradicts the interoperability / privacy claims
| # | Bug | Fix |
|---|-----|-----|
| 6 | Citizen PII (name, DOB) is written into `integration_events.payloadSummary`, contradicting "no source records, only bounded metadata". | Store only field names + a SHA-256 hash of the payload + row counts. Never persist values. |
| 7 | Consent is decorative: revoking changes nothing and `updateConsent` flips every scope at once. | Per-scope consent rows; connector calls + routing check the required scope and hard-fail (`FORBIDDEN`) when it is not granted. |
| 8 | `platform.detail` lets any official/admin open any application; department boundary is only on `updateStep`. | Enforce `departmentId` on read for `official`; `admin` still unrestricted but audited. |
| 9 | Officials lose cases: queue filters on `currentDepartmentId`, so routed/closed cases vanish. | Queue = "any step ever assigned to my department"; add a status filter (active / all). |
| 10 | "Immutable audit" = "no delete endpoint". No integrity guarantee. | Hash-chain: each row stores `prevHash` + `rowHash`. Add `audit.verifyChain` + downloadable proof. |
| 11 | `getDb()` fails silently; the whole app renders empty with no signal. | `system.health` endpoint (DB reachable? seeded? migration version) surfaced in the admin panel and a small status pill. |

### P2 — logic / correctness
| # | Bug | Fix |
|---|-----|-----|
| 12 | `updateStep` sets `completedAt: null` on any non-complete update → re-opening a step wipes its completion time. | Only set `completedAt` on `completed`/`rejected`; never null an existing value. |
| 13 | `blocked` vs `action_required` semantics muddled; the `else` branch also catches `in_progress`. | Explicit state machine in `server/workflow.ts` with a single transition function + unit tests. |
| 14 | `JSON.parse(consent.dataScopes)` unguarded → white screen on bad data. | Safe parse helper; scopes become real rows so no JSON string to parse. |
| 15 | `services` table is dead — `createApplication` ignores `serviceId` and hardcodes the slug. | Accept `serviceId`; drive department routing from `service_departments`. |
| 16 | `stats.avgDays` hardcoded `3.2`; revenue path skips date normalization the municipal path does. | Compute `avgDays` from `submittedAt`→terminal; normalize both connector date formats. |
| 17 | `contact` validated as `min(3)` though labelled "Contact email". | `z.string().email()`; add phone field with pattern. |

### P3 — frontend / UX / hygiene
| # | Bug | Fix |
|---|-----|-----|
| 18 | No theme switch at all (`// switchable` commented out); only light/dark, no "system"; `localStorage` read with no try/catch. | Replace bespoke `ThemeContext` with `next-themes` (already a dependency): `light / dark / system`, `try/catch`, no FOUC. |
| 19 | Fabricated figures shown to judges: connector latencies, "98.4%", `approved + 128`, fake app row `SG-2026-00014`, fallback `{active:18,…}`. | Remove every hardcoded metric; real queries or explicit empty states. |
| 20 | `/operations`, `/consent`, `/official`, `/admin` all render the same component; no real nav, guards, or breadcrumbs. | Real routes + `<RequireRole>` guards + persistent gov nav shell + breadcrumbs + skip-link. |
| 21 | SPA does full-page reloads (`window.location.reload/assign`). | `wouter` navigation + query invalidation. |
| 22 | Dead template code shipped: `ComponentShowcase` (1.4k lines, unrouted), `AIChatBox`, `Map`, `DashboardLayout*`, `dist/`, `*.bak`, `undefined.bak`. | Delete. Add them to `.gitignore` where appropriate. |
| 23 | Not GIGW/WCAG grade: 9–11px text, colour-only status, `<a>` without `href`, `<label>` without `htmlFor`, no focus rings, no landmarks. | Full accessibility pass; min 12px body / 16px base, semantic landmarks, visible focus, text+icon status, `aria-*`. |

---

## 2. Features to add (mapped to SIH26129)

**Interoperability core**
- Multi-service catalogue (Business Registration, Shops & Establishment, Trade Licence,
  Factory Licence, Fire NOC) — each with its own department route.
- Canonical schema registry + **connector OpenAPI spec** and an "Onboard a department"
  wizard (register endpoint + field mapping against the canonical model).
- Mock adapters for **DigiLocker, Aadhaar e-KYC, PAN, GSTN** as first-class connectors.
- Connector **retry queue** + degraded-mode UX + health history chart.

**Citizen value**
- **One-time document vault** — upload once, reference in every later application.
- **Consent ledger** — per-purpose, per-scope, time-boxed grants; one-tap revoke; an
  access log ("Revenue Dept read *date of birth* on 05 Sep for *identity check*").
- **RTS SLA timers** per step with auto-escalation on breach (Maharashtra Right to
  Public Services Act framing).
- Status **notifications** (in-app + email stub) and a **grievance / re-open** flow
  wired to `action_required`.
- Public **eligibility checker** + service directory (no login).

**Governance**
- Hash-chained tamper-evident audit + downloadable verification report.
- "Records stored: 0" data-sovereignty panel (hashes + coordination metadata only).
- Admin **bottleneck heatmap** + officer workload analytics (`recharts`).

**Reach / compliance**
- **i18n** (English, हिन्दी, मराठी fully; scaffold for the remaining scheduled
  languages) via `react-i18next`, with a language selector in the identification bar.
- GIGW + WCAG 2.1 AA pass.

---

## 3. Frontend rebuild

**Design system (`client/src/index.css` + tokens)**
- GIGW / india.gov.in idiom: top **identification bar** ("Government of Maharashtra |
  An initiative under …" + language selector + theme toggle), masthead with emblem
  lockup, primary nav, breadcrumb strip, structured footer (About / RTI / Accessibility
  / Sitemap / Contact), "last updated" line.
- Token sets for `light`, `dark`, `system` — semantic variables only, both themes
  defined explicitly, WCAG AA contrast.
- Typography: Noto Sans / Noto Sans Devanagari with system fallback (Devanagari needed
  for Hindi/Marathi).
- Reference cues: india.gov.in, MyScheme, MAITRI, NSWS, GOV.UK Design System.

**Pages / routes**
| Route | Purpose | Guard |
|-------|---------|-------|
| `/` | Public landing: what SetuGov is, service directory, eligibility checker, live (real) platform stats | none |
| `/services` · `/services/:slug` | Service catalogue + detail (eligibility, documents, departments, SLA) | none |
| `/apply/:slug` | Guided multi-step application wizard | citizen |
| `/dashboard` | Citizen: applications, journey timeline, notifications | citizen |
| `/applications/:id` | Unified cross-department timeline + documents + consent | owner/official/admin |
| `/consent` | Consent ledger + access log + document vault | citizen |
| `/work` | Official: department queue, case review, connector exchange | official/admin |
| `/admin` | Departments, connectors, connector onboarding, retry queue, audit chain, analytics | admin |
| `/health`, `/accessibility`, `*` | Status, a11y statement, 404 | none |

**Infra**
- `next-themes` provider at the root; `<html lang>` synced to the active language.
- `react-i18next` with namespaced JSON message catalogues under
  `client/src/i18n/{en,hi,mr}/`.
- `<AppShell>` (identification bar + masthead + nav + footer) wraps all routes.
- `<RequireRole roles=[...]>` guard component; unauthenticated → sign-in CTA, wrong
  role → 403 panel.

---

## 4. Execution order

1. **Setup**: local DB, `.env(.example)`, dev sign-in, baseline `check`/`test`.
2. **Phase 1 — backend + hygiene** (bugs 1–17, 21–22): schema for per-scope consent /
   audit chain / notifications / doc vault; `server/{connectors,workflow,audit}.ts`;
   router hardening; delete dead code; new migration.
3. **Phase 2 — features**: services catalogue, connector onboarding + adapters, retry
   queue, SLA timers, grievance flow, analytics endpoints.
4. **Phase 3 — frontend**: design tokens + `AppShell`, `next-themes`, `react-i18next`,
   rebuild every page, accessibility pass.
5. **Verify**: `pnpm check`, `pnpm test` (expanded), `pnpm build`, manual walkthrough of
   citizen → official → admin against the local DB; update `docs/MVP.md` +
   `docs/VERIFICATION.md`.

Each phase lands as its own commit on a feature branch off `main`.
