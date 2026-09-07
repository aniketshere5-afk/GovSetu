import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

type NavItem = { href: string; key: string; roles?: Array<"user" | "official" | "admin"> };

const ITEMS: NavItem[] = [
  { href: "/", key: "home" },
  { href: "/services", key: "services" },
  { href: "/track", key: "track" },
  { href: "/consent", key: "consent", roles: ["user"] },
  { href: "/work", key: "work", roles: ["official", "admin"] },
  { href: "/admin", key: "admin", roles: ["admin"] },
];

export function MainNav() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const items = ITEMS.filter(item => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <nav className="gov-nav" aria-label={t("nav.primary")}>
      <div className="gov-container gov-nav__inner">
        {items.map(({ href, key }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}>
              {t(`nav.${key}`)}
            </Link>
          );
        })}
        <span className="gov-nav__spacer" aria-hidden />
        {isAuthenticated && user ? (
          <button type="button" className="gov-nav__login" style={{ border: 0 }} onClick={() => void logout()}>
            <LogOut size={14} aria-hidden />
            &nbsp;{user.name?.split(" ")[0] ?? t("nav.account")} · {t("nav.signOut")}
          </button>
        ) : (
          <button type="button" className="gov-nav__login" style={{ border: 0 }} onClick={() => startLogin()}>
            {t("nav.signIn")}
          </button>
        )}
      </div>
    </nav>
  );
}
