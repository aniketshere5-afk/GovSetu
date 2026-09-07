import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { RequireRole } from "@/components/RequireRole";
import { StatusPill } from "@/components/StatusPill";

function TrackInner() {
  const { t } = useTranslation();
  const apps = trpc.platform.applications.useQuery();

  return (
    <>
      <h1 className="gov-h2">{t("track.title", "Track Applications")}</h1>
      {apps.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {apps.data?.length === 0 && (
        <div className="gov-panel max-w-lg">
          <div className="gov-panel__body text-sm text-muted-foreground">
            {t("track.empty", "You have no applications yet.")}{" "}
            <Link to="/services">{t("track.browse", "Browse services")}</Link>
          </div>
        </div>
      )}
      {!!apps.data?.length && (
        <div className="gov-table__scroll">
          <table className="gov-table">
            <thead>
              <tr>
                <th>{t("track.number", "Application no.")}</th>
                <th>{t("track.business", "Applicant / business")}</th>
                <th>{t("track.status", "Status")}</th>
                <th>{t("track.updated", "Updated")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {apps.data!.map(a => (
                <tr key={a.id}>
                  <td className="font-mono">{a.applicationNumber}</td>
                  <td>
                    {a.businessName}
                    <div className="text-xs text-muted-foreground">{a.businessType}</div>
                  </td>
                  <td><StatusPill kind="app" value={a.status} /></td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </td>
                  <td>
                    <Link to={`/applications/${a.id}`}>{t("track.open", "Open")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Track() {
  return (
    <RequireRole roles={["user", "official", "admin"]}>
      <AppShell breadcrumbs={[{ label: "Track Application" }]}>
        <TrackInner />
      </AppShell>
    </RequireRole>
  );
}
