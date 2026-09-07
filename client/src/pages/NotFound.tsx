import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { AppShell } from "@/components/layout/AppShell";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <AppShell breadcrumbs={[{ label: "404" }]}>
      <div className="gov-panel mx-auto max-w-lg text-center">
        <div className="gov-panel__body py-10">
          <p className="text-4xl font-bold text-[color:var(--gov-blue)]">404</p>
          <h1 className="mt-2 text-lg font-semibold">{t("notFound.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("notFound.body")}</p>
          <Link className="gov-btn gov-btn--primary mt-5" href="/">
            {t("guard.backHome")}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
