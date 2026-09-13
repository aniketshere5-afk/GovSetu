import { useTranslation } from "react-i18next";
import { useParams } from "wouter";
import { AlertTriangle, FileText, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { StatusPill } from "@/components/StatusPill";

function fmt(d: string | Date | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

function DetailInner() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const q = trpc.platform.detail.useQuery({ id: Number(id) }, { enabled: Boolean(id) });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (q.error) return <div className="gov-panel max-w-lg"><div className="gov-panel__body text-sm text-[color:var(--destructive)]">{q.error.message}</div></div>;
  if (!q.data) return <div className="gov-panel max-w-lg"><div className="gov-panel__body text-sm text-muted-foreground">{t("appDetail.notFound", "Application not found.")}</div></div>;

  const { application, steps, documents, scopes, events, accessLog } = q.data;
  const now = Date.now();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="gov-h2 mb-0">{application.applicationNumber}</h1>
        <StatusPill kind="app" value={application.status} />
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {application.businessName} · {application.businessType} · {application.address}
      </p>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <section className="gov-panel">
            <div className="gov-panel__head">{t("appDetail.timeline", "Unified timeline")}</div>
            <div className="gov-panel__body">
              <ul className="gov-timeline">
                {steps.map(s => {
                  const overdue = s.status === "in_progress" && s.slaDueAt && new Date(s.slaDueAt).getTime() < now;
                  return (
                    <li key={s.id} data-state={s.status}>
                      <span className="gov-timeline__dot" aria-hidden />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{s.label}</span>
                        <StatusPill kind="step" value={s.status} />
                        {overdue && (
                          <span className="gov-status gov-status--danger">
                            <AlertTriangle size={11} aria-hidden /> {t("appDetail.slaBreached", "SLA breached")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {s.responsibleRole}
                        {s.startedAt ? ` · ${t("appDetail.started", "started")} ${fmt(s.startedAt)}` : ""}
                        {s.completedAt ? ` · ${t("appDetail.completed", "completed")} ${fmt(s.completedAt)}` : ""}
                        {s.slaDueAt && !s.completedAt ? ` · ${t("appDetail.due", "due")} ${fmt(s.slaDueAt)}` : ""}
                      </div>
                      {s.remarks && <div className="mt-1 text-xs text-foreground">“{s.remarks}”</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="gov-panel">
            <div className="gov-panel__head">{t("appDetail.events", "Data-exchange events")}</div>
            <div className="gov-panel__body">
              {events.length === 0 && <p className="text-sm text-muted-foreground">{t("appDetail.noEvents", "No exchanges yet.")}</p>}
              <ul className="space-y-3">
                {events.map(e => (
                  <li key={e.id} className="border-b border-[color:var(--border)] pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{e.eventType}</span>
                      <span className="gov-status gov-status--info">{e.direction}</span>
                      <span className="text-xs text-muted-foreground">{fmt(e.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {e.sourceSchema} → {e.canonicalSchema}
                      {e.fieldNames ? ` · ${t("appDetail.fields", "fields")}: ${e.fieldNames}` : ""}
                    </div>
                    <div className="mt-1 text-xs">{e.payloadSummary}</div>
                    {e.payloadHash && (
                      <div className="mt-1 break-all font-mono text-[0.68rem] text-muted-foreground">
                        sha256:{e.payloadHash}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="gov-panel">
            <div className="gov-panel__head">
              <span className="flex items-center gap-2">
                <ShieldCheck size={15} aria-hidden /> {t("appDetail.consent", "Consent")}
              </span>
            </div>
            <div className="gov-panel__body">
              <ul className="space-y-2 text-sm">
                {scopes.map(sc => (
                  <li key={sc.id} className="flex items-center justify-between gap-2">
                    <span>{sc.scope}</span>
                    <span className={`gov-status gov-status--${sc.status === "granted" ? "success" : "danger"}`}>
                      {sc.status}
                    </span>
                  </li>
                ))}
                {scopes.length === 0 && <li className="text-muted-foreground">—</li>}
              </ul>
            </div>
          </section>

          <section className="gov-panel">
            <div className="gov-panel__head">{t("appDetail.documents", "Document references")}</div>
            <div className="gov-panel__body">
              <ul className="space-y-2 text-sm">
                {documents.map(d => (
                  <li key={d.id} className="flex items-start gap-2">
                    <FileText size={14} className="mt-0.5 flex-none text-muted-foreground" aria-hidden />
                    <span>
                      {d.documentType}
                      {d.referenceUrl?.startsWith("/uploads/") ? (
                        <a href={d.referenceUrl} target="_blank" rel="noreferrer" className="block break-all text-xs">
                          {d.fileName || t("appDetail.viewFile", "View file")}
                        </a>
                      ) : (
                        <span className="block break-all text-xs text-muted-foreground">{d.referenceUrl}</span>
                      )}
                    </span>
                  </li>
                ))}
                {documents.length === 0 && <li className="text-muted-foreground">—</li>}
              </ul>
            </div>
          </section>

          <section className="gov-panel">
            <div className="gov-panel__head">{t("appDetail.accessLog", "Who accessed what")}</div>
            <div className="gov-panel__body">
              {accessLog.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              <ul className="space-y-2 text-xs">
                {accessLog.map(l => (
                  <li key={l.id}>
                    <span className="font-medium">{l.scope}</span> · {l.purpose}
                    <span className="block text-muted-foreground">{fmt(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function ApplicationDetail() {
  return (
    <RequireRole roles={["user", "official", "admin"]}>
      <AppShell breadcrumbs={[{ label: "Track Application", href: "/track" }, { label: "Application" }]}>
        <DetailInner />
      </AppShell>
    </RequireRole>
  );
}
