import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Building2, FileText, LayoutGrid, ListChecks, ScrollText, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { signInEntry } from "@/lib/authEntry";
import { AppShell } from "@/components/layout/AppShell";
import { NoticeTicker } from "@/components/layout/NoticeTicker";

const SERVICE_ICONS: Record<string, typeof Building2> = {
  "business-registration": Building2,
};

export default function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const stats = trpc.platform.stats.useQuery(undefined, { staleTime: 30_000 });
  const health = trpc.platform.health.useQuery(undefined, { staleTime: 30_000 });
  const services = trpc.platform.services.useQuery(undefined, { staleTime: 60_000 });
  const departments = trpc.platform.departments.useQuery(undefined, { staleTime: 60_000 });

  const healthState =
    health.data?.database === "ok" ? "success" : health.data?.database === "unavailable" ? "warning" : "danger";
  const healthLabel =
    healthState === "success" ? t("status.operational") : healthState === "warning" ? t("status.degraded") : t("status.unavailable");
  const dash = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(n));

  const steps = [t("home.step1"), t("home.step2"), t("home.step3")];
  const notices = (t("home.noticesItems", { returnObjects: true }) as Array<{ date: string; text: string }>) ?? [];

  const startHref = isAuthenticated ? "/services" : undefined;

  return (
    <AppShell bleed>
      {/* Banner */}
      <section className="gov-banner">
        <div className="gov-container gov-banner__inner">
          <h1>{t("home.bannerTitle")}</h1>
          <p>{t("home.bannerText")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {startHref ? (
              <Link className="gov-btn gov-btn--primary" href={startHref}>
                {t("home.startApplication")}
              </Link>
            ) : (
              <button className="gov-btn gov-btn--primary" onClick={() => signInEntry()}>
                {t("home.startApplication")}
              </button>
            )}
            <Link className="gov-btn gov-btn--ghost" href="/track">
              {t("home.trackApplication")}
            </Link>
            <span className={`gov-status gov-status--${healthState}`}>● {healthLabel}</span>
          </div>
        </div>
      </section>
      <div className="gov-tricolour" aria-hidden />

      <div className="gov-container" style={{ paddingBlock: "18px 40px" }}>
        <NoticeTicker />

        {/* Online services */}
        <section className="mt-8">
          <h2 className="gov-h2">
            <LayoutGrid size={16} className="mb-0.5 mr-1.5 inline" aria-hidden />
            {t("home.servicesTitle")}
          </h2>
          <div className="gov-tiles">
            {(services.data ?? []).map(service => {
              const Icon = SERVICE_ICONS[service.slug] ?? FileText;
              return (
                <Link key={service.id} to={`/services/${service.slug}`} className="gov-tile">
                  <span className="gov-tile__icon">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span>
                    <span className="gov-tile__t">{service.name}</span>
                    <span className="gov-tile__d">
                      {t("home.serviceMeta", { days: service.expectedDays })}
                    </span>
                  </span>
                </Link>
              );
            })}
            <Link to="/services" className="gov-tile">
              <span className="gov-tile__icon">
                <ListChecks size={18} aria-hidden />
              </span>
              <span>
                <span className="gov-tile__t">{t("home.allServices")}</span>
                <span className="gov-tile__d">{t("home.allServicesMeta")}</span>
              </span>
            </Link>
          </div>
        </section>

        {/* Dashboard strip */}
        <section className="mt-8">
          <h2 className="gov-h2">{t("home.dashboardTitle")}</h2>
          <div className="gov-stats">
            <div className="gov-stat">
              <div className="gov-stat__n">{dash(stats.data?.active)}</div>
              <div className="gov-stat__l">{t("home.statActive")}</div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat__n">{dash(stats.data?.approved)}</div>
              <div className="gov-stat__l">{t("home.statApproved")}</div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat__n">{dash(stats.data?.avgDays ?? null)}</div>
              <div className="gov-stat__l">{t("home.statAvgDays")}</div>
            </div>
            <div className="gov-stat">
              <div className="gov-stat__n">{dash(departments.data?.length ?? null)}</div>
              <div className="gov-stat__l">{t("home.statConnected")}</div>
            </div>
          </div>
        </section>

        {/* Notices + How it works */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section className="gov-panel">
            <div className="gov-panel__head">
              {t("home.noticesTitle")}
              <Link to="/notices" className="text-xs font-normal">
                {t("common.viewAll")}
              </Link>
            </div>
            <div className="gov-panel__body">
              <ul className="gov-notices">
                {notices.map((n, i) => (
                  <li key={i}>
                    <time>{n.date}</time>
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="gov-panel">
            <div className="gov-panel__head">{t("home.howTitle")}</div>
            <div className="gov-panel__body">
              <div className="gov-steps" style={{ border: 0 }}>
                {steps.map((s, i) => (
                  <div className="gov-step" key={i} style={{ border: "1px solid var(--border)" }}>
                    <span className="gov-step__n">{i + 1}</span>
                    <div className="gov-step__t">{s.split("—")[0]}</div>
                    <div className="gov-step__d">{s.split("—")[1] ?? ""}</div>
                  </div>
                ))}
              </div>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <ShieldCheck size={14} className="mt-0.5 flex-none" style={{ color: "var(--tri-green)" }} aria-hidden />
                  {t("home.trustConsent")}
                </li>
                <li className="flex gap-2">
                  <ScrollText size={14} className="mt-0.5 flex-none" style={{ color: "var(--tri-green)" }} aria-hidden />
                  {t("home.trustAudit")}
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
