import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { signInEntry } from "@/lib/authEntry";
import { AppShell } from "@/components/layout/AppShell";

export default function ServiceDetail() {
  const { t } = useTranslation();
  const { slug = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const detail = trpc.platform.serviceDetail.useQuery({ slug }, { enabled: Boolean(slug) });

  if (detail.isLoading) {
    return (
      <AppShell breadcrumbs={[{ label: t("nav.services"), href: "/services" }]}>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </AppShell>
    );
  }
  if (!detail.data) {
    return (
      <AppShell breadcrumbs={[{ label: t("nav.services"), href: "/services" }]}>
        <div className="gov-panel max-w-lg">
          <div className="gov-panel__body text-sm text-muted-foreground">
            {t("serviceDetail.notFound", "This service could not be found.")}
          </div>
        </div>
      </AppShell>
    );
  }

  const { service, route, requiredDocuments } = detail.data;

  return (
    <AppShell
      breadcrumbs={[{ label: t("nav.services"), href: "/services" }, { label: service.name }]}
    >
      <h1 className="gov-h2">{service.name}</h1>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <div className="gov-panel">
            <div className="gov-panel__head">{t("serviceDetail.about", "About this service")}</div>
            <div className="gov-panel__body space-y-3 text-sm text-muted-foreground">
              <p>{service.description}</p>
              <p>
                <strong className="text-foreground">{t("serviceDetail.eligibility", "Eligibility")}: </strong>
                {service.eligibility}
              </p>
            </div>
          </div>

          <div className="gov-panel">
            <div className="gov-panel__head">{t("serviceDetail.journey", "Department journey")}</div>
            <div className="gov-panel__body">
              <ol className="space-y-3">
                {route.map((r, i) => (
                  <li key={r.stepKey} className="flex gap-3">
                    <span className="gov-step__n mt-0.5">{i + 1}</span>
                    <div>
                      <div className="text-sm font-semibold">{r.stepLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.departmentName} · {t("serviceDetail.source", "source system")}: {r.sourceSystem} ·{" "}
                        {t("serviceDetail.sla", "SLA")} {r.slaDays} {t("services.days", "working days")}
                      </div>
                      {r.requiredScope && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t("serviceDetail.usesScope", "Uses consented data")}: <em>{r.requiredScope}</em>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="gov-panel">
            <div className="gov-panel__head">{t("serviceDetail.documents", "Documents required")}</div>
            <div className="gov-panel__body">
              <ul className="space-y-2 text-sm">
                {requiredDocuments.map(doc => (
                  <li key={doc} className="flex items-start gap-2">
                    <FileText size={14} className="mt-0.5 flex-none text-muted-foreground" aria-hidden />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="gov-panel">
            <div className="gov-panel__body">
              <p className="text-sm text-muted-foreground">
                {t("serviceDetail.applyNote", "You will be asked to grant purpose-limited consent for each department before submitting.")}
              </p>
              {isAuthenticated ? (
                <Link className="gov-btn gov-btn--primary mt-4 w-full justify-center" to={`/apply/${service.slug}`}>
                  {t("serviceDetail.apply", "Apply for this service")}
                  <ArrowRight size={15} aria-hidden />
                </Link>
              ) : (
                <button className="gov-btn gov-btn--primary mt-4 w-full justify-center" onClick={() => signInEntry()}>
                  {t("serviceDetail.signInToApply", "Sign in to apply")}
                </button>
              )}
            </div>
          </div>

          <div className="gov-panel">
            <div className="gov-panel__body flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 size={14} className="mt-0.5 flex-none" style={{ color: "var(--tri-green)" }} aria-hidden />
              {t("serviceDetail.sovereignty", "Departments keep their own records. SetuGov coordinates the exchange and stores only metadata.")}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
