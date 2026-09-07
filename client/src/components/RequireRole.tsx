import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { signInEntry } from "@/lib/authEntry";
import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";

type Role = "user" | "official" | "admin";

/**
 * Client-side route guard. Server procedures enforce their own role checks; this
 * only decides which shell the visitor sees.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="gov-panel mx-auto max-w-lg">
          <div className="gov-panel__head">{t("guard.signInRequired")}</div>
          <div className="gov-panel__body">
            <p className="text-sm text-muted-foreground">{t("guard.signInBody")}</p>
            <button className="gov-btn gov-btn--primary mt-4" onClick={() => signInEntry()}>
              {t("nav.signIn")}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (user && !roles.includes(user.role)) {
    return (
      <AppShell>
        <div className="gov-panel mx-auto max-w-lg">
          <div className="gov-panel__head">{t("guard.noAccess")}</div>
          <div className="gov-panel__body">
            <p className="text-sm text-muted-foreground">
              {t("guard.noAccessBody", { role: user.role })}
            </p>
            <Link className="gov-btn gov-btn--ghost mt-4" href="/">
              {t("guard.backHome")}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
