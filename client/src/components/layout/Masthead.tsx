import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Phone } from "lucide-react";
import { Emblem } from "./Emblem";
import { NotificationsBell } from "./NotificationsBell";

export function Masthead() {
  const { t } = useTranslation();
  return (
    <header className="gov-masthead">
      <div className="gov-container gov-masthead__inner">
        <Link href="/" className="gov-lockup" aria-label={`${t("brand.name")} — ${t("brand.tagline")}`}>
          <Emblem className="gov-lockup__seal" title={t("brand.name")} />
          <span className="gov-lockup__text">
            <span className="en">{t("brand.name")}</span>
            <span className="hi">{t("brand.hiName")}</span>
            <span className="org">{t("brand.govtOf")}</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="gov-masthead__aside">
            <strong>{t("brand.tagline")}</strong>
            <span className="mt-1 inline-flex items-center gap-1.5">
              <Phone size={13} aria-hidden />
              {t("masthead.helpline")}: 1800-XXX-XXXX
            </span>
          </div>
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
