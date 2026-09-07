import { useTranslation } from "react-i18next";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Demo role picker. Only routed when VITE_DEMO_AUTH="1" (the hosted SIH demo);
 * the buttons hit the server's /api/auth/dev route, which is itself gated by
 * DEMO_AUTH on the backend.
 */
export default function DemoLogin() {
  const { t } = useTranslation();

  const roles = [
    { role: "user", href: "/api/auth/dev?role=user", icon: UserRound, label: t("demo.citizen", "Citizen"), desc: t("demo.citizenDesc", "Apply for services, track applications, manage consent and documents.") },
    { role: "official", href: "/api/auth/dev?role=official&dept=REV", icon: Building2, label: t("demo.official", "Department official (Revenue)"), desc: t("demo.officialDesc", "Review the department queue and act on milestones.") },
    { role: "admin", href: "/api/auth/dev?role=admin", icon: ShieldCheck, label: t("demo.admin", "Administrator"), desc: t("demo.adminDesc", "Connectors, analytics, audit trail, users and grievances.") },
  ];

  return (
    <AppShell breadcrumbs={[{ label: t("demo.title", "Demo sign-in") }]}>
      <h1 className="gov-h2">{t("demo.title", "Demo sign-in")}</h1>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        {t("demo.intro", "This is a Smart India Hackathon prototype with seeded sample data only. Choose a role to explore the corresponding experience.")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {roles.map(r => (
          <a key={r.role} href={r.href} className="gov-panel block no-underline">
            <div className="gov-panel__head">
              <span className="flex items-center gap-2">
                <r.icon size={16} aria-hidden />
                {r.label}
              </span>
            </div>
            <div className="gov-panel__body text-sm text-muted-foreground">{r.desc}</div>
          </a>
        ))}
      </div>
    </AppShell>
  );
}
