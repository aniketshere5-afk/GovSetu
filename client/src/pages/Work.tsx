import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, Network, RotateCcw, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { StatusPill } from "@/components/StatusPill";

function fmt(d: string | Date | null | undefined) {
  return d ? new Date(d).toLocaleString() : "—";
}

function WorkInner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queue = trpc.platform.officialQueue.useQuery();
  const [appId, setAppId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");
  useEffect(() => {
    if (appId === null && queue.data?.length) setAppId(queue.data[0].id);
  }, [appId, queue.data]);

  const detail = trpc.platform.detail.useQuery({ id: appId ?? 0 }, { enabled: Boolean(appId) });
  const adapters = trpc.platform.adapters.useQuery();
  const [exSource, setExSource] = useState<string>("revenue");
  const refetch = () => {
    queue.refetch();
    detail.refetch();
  };
  const step = trpc.platform.updateStep.useMutation({
    onSuccess: r => {
      toast.success(r.finalStatus ? t("work.final", { defaultValue: "Application {{s}}", s: r.finalStatus }) : t("work.routed", "Milestone updated"));
      setRemarks("");
      refetch();
    },
    onError: e => toast.error(e.message),
  });
  const exchange = trpc.platform.connectorExchange.useMutation({
    onSuccess: () => {
      toast.success(t("work.exchanged", "Source payload normalised and logged"));
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const myDeptId = user?.departmentId ?? null;

  return (
    <>
      <h1 className="gov-h2">{t("work.title", "Department Workspace")}</h1>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <nav className="gov-panel h-max">
          <div className="gov-panel__head">
            {t("work.queue", "Review queue")}
            <span className="gov-status gov-status--info">{queue.data?.length ?? 0}</span>
          </div>
          <ul>
            {queue.data?.map(item => (
              <li key={item.id}>
                <button
                  className={`w-full border-b border-[color:var(--border)] px-3 py-2 text-left text-sm last:border-0 ${item.id === appId ? "bg-[color:var(--surface-head)] font-semibold" : ""}`}
                  onClick={() => setAppId(item.id)}
                >
                  {item.applicationNumber}
                  <span className="mt-1 flex items-center gap-2 text-xs font-normal text-muted-foreground">
                    {item.businessName} <StatusPill kind="app" value={item.status} />
                  </span>
                </button>
              </li>
            ))}
            {queue.data?.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-foreground">{t("work.empty", "No cases assigned.")}</li>
            )}
          </ul>
        </nav>

        <div className="space-y-5">
          {detail.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {detail.data && (
            <>
              <section className="gov-panel">
                <div className="gov-panel__head">
                  {detail.data.application.applicationNumber}
                  <StatusPill kind="app" value={detail.data.application.status} />
                </div>
                <div className="gov-panel__body text-sm text-muted-foreground">
                  {detail.data.application.businessName} · {detail.data.application.businessType} ·{" "}
                  {detail.data.application.address}
                </div>
              </section>

              <section className="gov-panel">
                <div className="gov-panel__head">{t("work.milestones", "Milestones")}</div>
                <div className="gov-panel__body space-y-4">
                  {detail.data.steps.map(s => {
                    const mine = !myDeptId || s.departmentId === myDeptId;
                    return (
                      <div key={s.id} className="border-b border-[color:var(--border)] pb-4 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{s.label}</span>
                          <StatusPill kind="step" value={s.status} />
                          {!mine && <span className="text-xs text-muted-foreground">({t("work.otherDept", "other department")})</span>}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.responsibleRole} · {t("appDetail.started", "started")} {fmt(s.startedAt)} ·{" "}
                          {t("appDetail.due", "due")} {fmt(s.slaDueAt)}
                        </div>
                        {s.remarks && <div className="mt-1 text-xs">“{s.remarks}”</div>}

                        {mine && s.status === "in_progress" && (
                          <div className="mt-3 space-y-2">
                            <textarea
                              className="gov-input"
                              rows={2}
                              placeholder={t("work.remarkPlaceholder", "Decision remark (required to request action or reject)")}
                              value={remarks}
                              onChange={e => setRemarks(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button className="gov-btn gov-btn--primary" disabled={step.isPending}
                                onClick={() => step.mutate({ stepId: s.id, status: "completed", remarks })}>
                                <CheckCircle2 size={14} aria-hidden /> {t("work.complete", "Complete & route")}
                              </button>
                              <button className="gov-btn gov-btn--ghost" disabled={step.isPending}
                                onClick={() => step.mutate({ stepId: s.id, status: "blocked", remarks })}>
                                <RotateCcw size={14} aria-hidden /> {t("work.requestAction", "Request action")}
                              </button>
                              <button className="gov-btn gov-btn--ghost" disabled={step.isPending}
                                onClick={() => step.mutate({ stepId: s.id, status: "rejected", remarks })}>
                                <XCircle size={14} aria-hidden /> {t("work.reject", "Reject")}
                              </button>
                              <span className="inline-flex items-center gap-1.5">
                                <select
                                  className="gov-input"
                                  style={{ width: "auto" }}
                                  value={exSource}
                                  onChange={e => setExSource(e.target.value)}
                                  aria-label={t("work.adapter", "Connector adapter")}
                                >
                                  {(adapters.data ?? []).map(a => (
                                    <option key={a.system} value={a.system}>{a.label}</option>
                                  ))}
                                </select>
                                <button className="gov-btn gov-btn--ghost" disabled={exchange.isPending}
                                  onClick={() => {
                                    const app = detail.data!.application;
                                    const payloadBySource: Record<string, Record<string, string>> = {
                                      revenue: { citizen_name: app.businessName, dob: "1990-01-01" },
                                      municipal: { fullAddress: app.address },
                                      digilocker: { doc_type: "identity", issuer: "UIDAI", name: app.businessName },
                                      aadhaar: { name: app.businessName, dob: "1990-01-01", address: app.address },
                                      pan: { pan: "ABCDE1234F", name: app.businessName },
                                      gstn: { gstin: "27ABCDE1234F1Z5", legal_name: app.businessName },
                                    };
                                    exchange.mutate({
                                      applicationId: app.id,
                                      connectorId: 1,
                                      source: exSource as never,
                                      payload: payloadBySource[exSource] ?? {},
                                    });
                                  }}>
                                  <Network size={14} aria-hidden /> {t("work.normalize", "Normalise exchange")}
                                </button>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="gov-panel">
                <div className="gov-panel__head">{t("appDetail.events", "Integration events")}</div>
                <div className="gov-panel__body">
                  {detail.data.events.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                  <ul className="space-y-2 text-xs">
                    {detail.data.events.map(e => (
                      <li key={e.id} className="border-b border-[color:var(--border)] pb-2 last:border-0">
                        <span className="font-semibold">{e.eventType}</span> · {e.direction} · {fmt(e.createdAt)}
                        <div className="text-muted-foreground">
                          {e.sourceSchema} → {e.canonicalSchema}
                          {e.fieldNames ? ` · ${e.fieldNames}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Work() {
  return (
    <RequireRole roles={["official", "admin"]}>
      <AppShell breadcrumbs={[{ label: "Department Workspace" }]}>
        <WorkInner />
      </AppShell>
    </RequireRole>
  );
}
