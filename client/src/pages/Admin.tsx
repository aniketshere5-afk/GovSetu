import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";

const TABS = ["overview", "connectors", "departments", "audit", "users", "grievances"] as const;
type Tab = (typeof TABS)[number];

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminInner() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("overview");
  const utils = trpc.useUtils();

  const overview = trpc.platform.adminOverview.useQuery();
  const analytics = trpc.platform.analytics.useQuery();
  const audit = trpc.platform.verifyAudit.useQuery();
  const users = trpc.platform.users.useQuery(undefined, { enabled: tab === "users" });
  const departments = trpc.platform.departments.useQuery();
  const adapters = trpc.platform.adapters.useQuery();
  const grievances = trpc.platform.grievances.useQuery(undefined, { enabled: tab === "grievances" });
  const addConn = trpc.platform.addConnector.useMutation({
    onSuccess: () => { toast.success(t("admin.saved", "Saved")); overview.refetch(); },
    onError: e => toast.error(e.message),
  });

  const refetchAll = () => {
    overview.refetch();
    analytics.refetch();
    audit.refetch();
  };
  const setConn = trpc.platform.setConnectorStatus.useMutation({ onSuccess: () => { toast.success(t("admin.saved", "Saved")); overview.refetch(); }, onError: e => toast.error(e.message) });
  const updConn = trpc.platform.updateConnector.useMutation({ onSuccess: () => { toast.success(t("admin.saved", "Saved")); overview.refetch(); }, onError: e => toast.error(e.message) });
  const updDept = trpc.platform.updateDepartment.useMutation({ onSuccess: () => { toast.success(t("admin.saved", "Saved")); departments.refetch(); overview.refetch(); }, onError: e => toast.error(e.message) });
  const retry = trpc.platform.retryEvent.useMutation({ onSuccess: () => { toast.success(t("admin.retried", "Event retried")); refetchAll(); }, onError: e => toast.error(e.message) });
  const assign = trpc.platform.assignRole.useMutation({ onSuccess: () => { toast.success(t("admin.roleSaved", "Role updated")); users.refetch(); }, onError: e => toast.error(e.message) });
  const updGrv = trpc.platform.updateGrievance.useMutation({ onSuccess: () => { toast.success(t("admin.saved", "Saved")); grievances.refetch(); }, onError: e => toast.error(e.message) });

  return (
    <>
      <h1 className="gov-h2">{t("admin.title", "Administration")}</h1>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-[color:var(--border)]">
        {TABS.map(x => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`px-3 py-2 text-sm ${tab === x ? "border-b-2 border-[color:var(--gov-blue)] font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {t(`admin.tab.${x}`, x[0].toUpperCase() + x.slice(1))}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="gov-stats">
            {(analytics.data?.byStatus ?? []).map(s => (
              <div className="gov-stat" key={s.status}>
                <div className="gov-stat__n">{s.count}</div>
                <div className="gov-stat__l capitalize">{s.status.replace(/_/g, " ")}</div>
              </div>
            ))}
            <div className="gov-stat">
              <div className="gov-stat__n" style={{ color: analytics.data?.slaBreaches ? "var(--destructive)" : undefined }}>
                {analytics.data?.slaBreaches ?? 0}
              </div>
              <div className="gov-stat__l">{t("admin.slaBreaches", "SLA breaches")}</div>
            </div>
          </div>

          <section className="gov-panel">
            <div className="gov-panel__head">{t("admin.bottleneck", "Department workload & throughput")}</div>
            <div className="gov-table__scroll">
              <table className="gov-table">
                <thead>
                  <tr>
                    <th>{t("admin.department", "Department")}</th>
                    <th>{t("admin.open", "Open steps")}</th>
                    <th>{t("admin.completed", "Completed")}</th>
                    <th>{t("admin.avgHours", "Avg hours/step")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.data?.byDepartment ?? []).map(d => (
                    <tr key={d.departmentId}>
                      <td>{d.departmentName}</td>
                      <td>{d.open}</td>
                      <td>{d.completed}</td>
                      <td>{d.avgHours ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gov-panel">
            <div className="gov-panel__head">
              <span className="flex items-center gap-2">
                {audit.data?.ok ? <ShieldCheck size={15} style={{ color: "var(--tri-green)" }} /> : <ShieldAlert size={15} style={{ color: "var(--destructive)" }} />}
                {t("admin.auditChain", "Audit chain integrity")}
              </span>
            </div>
            <div className="gov-panel__body text-sm">
              {audit.data?.ok
                ? t("admin.auditOk", { defaultValue: "Verified — {{n}} entries, chain intact.", n: audit.data.total })
                : t("admin.auditBroken", { defaultValue: "BROKEN at entry #{{id}} — an audit row was altered or deleted.", id: audit.data?.brokenAtId })}
              <div className="mt-1 break-all font-mono text-xs text-muted-foreground">head: {audit.data?.headHash}</div>
            </div>
          </section>
        </div>
      )}

      {tab === "connectors" && (
        <div className="space-y-4">
          <div className="gov-panel">
            <div className="gov-panel__head">
              {t("admin.onboard", "Onboard a department connector")}
              <button
                className="gov-btn gov-btn--ghost"
                onClick={async () => downloadJson("setugov-connector-openapi.json", await utils.platform.connectorSpec.fetch())}
              >
                {t("admin.downloadSpec", "Download OpenAPI contract")}
              </button>
            </div>
            <form
              className="gov-panel__body grid gap-3 sm:grid-cols-2"
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                addConn.mutate({
                  departmentId: Number(f.get("departmentId")),
                  name: String(f.get("name")),
                  endpoint: String(f.get("endpoint")),
                  systemType: String(f.get("systemType")),
                });
                e.currentTarget.reset();
              }}
            >
              <label className="text-xs">{t("admin.department", "Department")}
                <select name="departmentId" className="gov-input mt-1" required>
                  <option value="">—</option>
                  {(departments.data ?? []).map(d => <option key={d.id} value={d.id}>{d.shortName}</option>)}
                </select>
              </label>
              <label className="text-xs">{t("admin.systemType", "System type")}
                <select name="systemType" className="gov-input mt-1">
                  {(adapters.data ?? []).map(a => <option key={a.system} value={a.label}>{a.label}</option>)}
                  <option>Custom REST</option>
                </select>
              </label>
              <label className="text-xs">{t("admin.name", "Connector name")}<input name="name" className="gov-input mt-1" required /></label>
              <label className="text-xs">{t("admin.endpoint", "Endpoint")}<input name="endpoint" className="gov-input mt-1" defaultValue="/api/connectors/" required /></label>
              <button className="gov-btn gov-btn--primary sm:col-span-2" style={{ justifySelf: "start" }} type="submit">
                {t("admin.addConnector", "Add connector")}
              </button>
            </form>
          </div>

          {(overview.data?.connectors ?? []).map(c => (
            <form
              key={c.id}
              className="gov-panel"
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                updConn.mutate({ connectorId: c.id, name: String(f.get("name")), endpoint: String(f.get("endpoint")), systemType: String(f.get("systemType")) });
              }}
            >
              <div className="gov-panel__head">
                {c.name}
                <span className={`gov-status gov-status--${c.status === "healthy" ? "success" : c.status === "degraded" ? "warning" : "danger"}`}>{c.status}</span>
              </div>
              <div className="gov-panel__body grid gap-3 sm:grid-cols-3">
                <label className="text-xs">{t("admin.name", "Name")}<input name="name" defaultValue={c.name} className="gov-input mt-1" /></label>
                <label className="text-xs">{t("admin.endpoint", "Endpoint")}<input name="endpoint" defaultValue={c.endpoint} className="gov-input mt-1" /></label>
                <label className="text-xs">{t("admin.systemType", "System type")}<input name="systemType" defaultValue={c.systemType} className="gov-input mt-1" /></label>
                <div className="flex gap-2 sm:col-span-3">
                  <button className="gov-btn gov-btn--primary" type="submit">{t("admin.save", "Save")}</button>
                  <button
                    type="button"
                    className="gov-btn gov-btn--ghost"
                    onClick={() => setConn.mutate({ connectorId: c.id, status: c.status === "disabled" ? "healthy" : "disabled" })}
                  >
                    {c.status === "disabled" ? t("admin.enable", "Enable") : t("admin.disable", "Disable")}
                  </button>
                </div>
              </div>
            </form>
          ))}
        </div>
      )}

      {tab === "departments" && (
        <div className="space-y-4">
          {(departments.data ?? []).map(d => (
            <form
              key={d.id}
              className="gov-panel"
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                updDept.mutate({ departmentId: d.id, name: String(f.get("name")), sourceSystem: String(f.get("sourceSystem")) });
              }}
            >
              <div className="gov-panel__head">{d.shortName}</div>
              <div className="gov-panel__body grid gap-3 sm:grid-cols-2">
                <label className="text-xs">{t("admin.name", "Name")}<input name="name" defaultValue={d.name} className="gov-input mt-1" /></label>
                <label className="text-xs">{t("admin.sourceSystem", "Source system")}<input name="sourceSystem" defaultValue={d.sourceSystem} className="gov-input mt-1" /></label>
                <button className="gov-btn gov-btn--primary sm:col-span-2" type="submit" style={{ justifySelf: "start" }}>{t("admin.save", "Save")}</button>
              </div>
            </form>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <section className="gov-panel">
          <div className="gov-panel__head">
            {t("admin.eventsAudit", "Integration events & audit log")}
            <button
              className="gov-btn gov-btn--ghost"
              onClick={async () => downloadJson("setugov-audit-proof.json", await utils.platform.auditProof.fetch())}
            >
              {t("admin.downloadProof", "Download verification report")}
            </button>
          </div>
          <div className="gov-table__scroll">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>{t("admin.time", "Time")}</th>
                  <th>{t("admin.event", "Event")}</th>
                  <th>{t("admin.detail", "Detail")}</th>
                  <th>{t("admin.status", "Status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(overview.data?.events ?? []).map(e => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                    <td>{e.eventType}</td>
                    <td className="text-muted-foreground">{e.sourceSchema} → {e.canonicalSchema}</td>
                    <td><span className={`gov-status gov-status--${e.status === "processed" ? "success" : "warning"}`}>{e.status}</span></td>
                    <td>
                      {e.status !== "processed" && (
                        <button className="gov-btn gov-btn--ghost" onClick={() => retry.mutate({ eventId: e.id })}>
                          <RotateCcw size={13} aria-hidden /> {t("admin.retry", "Retry")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="gov-panel__body text-xs text-muted-foreground">
            {t("admin.auditCount", { defaultValue: "{{n}} append-only audit entries. No update or delete procedure is exposed.", n: overview.data?.audits.length ?? 0 })}
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="gov-panel">
          <div className="gov-panel__head">{t("admin.users", "Users & roles")}</div>
          <div className="gov-table__scroll">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>{t("admin.userName", "Name")}</th>
                  <th>{t("admin.email", "Email")}</th>
                  <th>{t("admin.role", "Role")}</th>
                  <th>{t("admin.department", "Department")}</th>
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map(u => (
                  <tr key={u.id}>
                    <td>{u.name ?? "—"}</td>
                    <td className="text-muted-foreground">{u.email ?? "—"}</td>
                    <td>
                      <select
                        className="gov-input"
                        defaultValue={u.role}
                        onChange={e =>
                          assign.mutate({
                            userId: u.id,
                            role: e.target.value as "user" | "official" | "admin",
                            departmentId: u.departmentId ?? null,
                          })
                        }
                      >
                        <option value="user">user</option>
                        <option value="official">official</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="gov-input"
                        defaultValue={String(u.departmentId ?? "")}
                        onChange={e =>
                          assign.mutate({
                            userId: u.id,
                            role: u.role === "user" ? "official" : u.role,
                            departmentId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {(departments.data ?? []).map(d => (
                          <option key={d.id} value={d.id}>{d.shortName}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "grievances" && (
        <section className="gov-panel">
          <div className="gov-panel__head">{t("admin.grievances", "Grievances")}</div>
          <div className="gov-panel__body space-y-4">
            {(grievances.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            {(grievances.data ?? []).map(g => (
              <div key={g.id} className="border-b border-[color:var(--border)] pb-4 last:border-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono">{g.ticketNumber}</span>
                  <span className="font-semibold">{g.subject}</span>
                  <span className="gov-status gov-status--info">{g.category}</span>
                  <span className={`gov-status gov-status--${g.status === "resolved" || g.status === "closed" ? "success" : "warning"}`}>{g.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{g.body}</p>
                <form
                  className="mt-2 flex flex-wrap items-center gap-2"
                  onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    updGrv.mutate({ id: g.id, status: String(f.get("status")) as never, response: String(f.get("response")) || undefined });
                  }}
                >
                  <select name="status" defaultValue={g.status} className="gov-input" style={{ width: "auto" }}>
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                  <input name="response" placeholder={t("admin.response", "Response")} defaultValue={g.response ?? ""} className="gov-input" style={{ maxWidth: 320 }} />
                  <button className="gov-btn gov-btn--primary" type="submit"><CheckCircle2 size={13} aria-hidden /> {t("admin.save", "Save")}</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function Admin() {
  return (
    <RequireRole roles={["admin"]}>
      <AppShell breadcrumbs={[{ label: "Administration" }]}>
        <AdminInner />
      </AppShell>
    </RequireRole>
  );
}
