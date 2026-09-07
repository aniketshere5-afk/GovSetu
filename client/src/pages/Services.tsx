import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Building2, FileText, Landmark, Clock, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";

const ICONS: Record<string, typeof Building2> = {
  "business-registration": Building2,
  "shops-establishment": Landmark,
  "trade-licence": FileText,
};

export default function Services() {
  const { t } = useTranslation();
  const services = trpc.platform.services.useQuery();

  return (
    <AppShell breadcrumbs={[{ label: t("nav.services") }]}>
      <h1 className="gov-h2">{t("services.title", "Service Directory")}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        {t("services.intro", "Every service below is delivered through a single connected application. Choose a service to see the departments involved, the documents required and the indicative timeline.")}
      </p>

      {services.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {(services.data ?? []).map(service => {
          const Icon = ICONS[service.slug] ?? FileText;
          return (
            <div key={service.id} className="gov-panel flex flex-col">
              <div className="gov-panel__head">
                <span className="flex items-center gap-2">
                  <Icon size={16} aria-hidden />
                  {service.name}
                </span>
              </div>
              <div className="gov-panel__body flex flex-1 flex-col">
                <p className="flex-1 text-sm text-muted-foreground">{service.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={13} aria-hidden />
                  {t("services.timeline", "Indicative timeline")}: {service.expectedDays} {t("services.days", "working days")}
                </div>
                <Link className="gov-btn gov-btn--ghost mt-4 self-start" to={`/services/${service.slug}`}>
                  {t("services.view", "View service details")}
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
