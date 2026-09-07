import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";

function ConsentInner() {
  const { t } = useTranslation();
  const apps = trpc.platform.applications.useQuery();
  const [appId, setAppId] = useState<number | null>(null);
  useEffect(() => {
    if (appId === null && apps.data?.length) setAppId(apps.data[0].id);
  }, [appId, apps.data]);

  const detail = trpc.platform.detail.useQuery({ id: appId ?? 0 }, { enabled: Boolean(appId) });
  const update = trpc.platform.updateConsent.useMutation({
    onSuccess: () => {
      toast.success(t("consent.updated", "Consent updated"));
      detail.refetch();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <>
      <h1 className="gov-h2">{t("consent.title", "Consent & Data Sharing")}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        {t("consent.intro", "Each scope is a specific permission for a specific purpose. Withdrawing a scope blocks any further department exchange that needs it.")}
      </p>

      {apps.data?.length === 0 && (
        <div className="gov-panel max-w-lg">
          <div className="gov-panel__body text-sm text-muted-foreground">
            {t("consent.noApps", "You have no applications yet.")} <Link to="/services">{t("track.browse", "Browse services")}</Link>
          </div>
        </div>
      )}

      {!!apps.data?.length && (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <nav className="gov-panel h-max">
            <div className="gov-panel__head">{t("consent.applications", "Applications")}</div>
            <ul>
              {apps.data!.map(a => (
                <li key={a.id}>
                  <button
                    className={`w-full border-b border-[color:var(--border)] px-3 py-2 text-left text-sm last:border-0 ${a.id === appId ? "bg-[color:var(--surface-head)] font-semibold" : ""}`}
                    onClick={() => setAppId(a.id)}
                  >
                    {a.applicationNumber}
                    <span className="block text-xs text-muted-foreground">{a.businessName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-5">
            <section className="gov-panel">
              <div className="gov-panel__head">{t("consent.scopes", "Granted scopes")}</div>
              <div className="gov-panel__body">
                {detail.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
                <ul className="space-y-3">
                  {detail.data?.scopes.map(sc => (
                    <li key={sc.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3 last:border-0">
                      <div>
                        <div className="text-sm font-semibold">{sc.scope}</div>
                        <div className="text-xs text-muted-foreground">{sc.purpose}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`gov-status gov-status--${sc.status === "granted" ? "success" : "danger"}`}>{sc.status}</span>
                        <button
                          className="gov-btn gov-btn--ghost"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              applicationId: appId!,
                              scope: sc.scope,
                              status: sc.status === "granted" ? "revoked" : "granted",
                            })
                          }
                        >
                          {sc.status === "granted" ? t("consent.revoke", "Withdraw") : t("consent.grant", "Re-grant")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="gov-panel">
              <div className="gov-panel__head">{t("appDetail.accessLog", "Access log")}</div>
              <div className="gov-panel__body">
                {detail.data?.accessLog.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                <ul className="space-y-2 text-xs">
                  {detail.data?.accessLog.map(l => (
                    <li key={l.id}>
                      <span className="font-medium">{l.scope}</span> · {l.purpose}
                      <span className="block text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

export default function Consent() {
  return (
    <RequireRole roles={["user"]}>
      <AppShell breadcrumbs={[{ label: "Consent & Data" }]}>
        <ConsentInner />
      </AppShell>
    </RequireRole>
  );
}
