import { useTranslation } from "react-i18next";
import { Link } from "wouter";

const BUILD_DATE = new Date().toISOString().slice(0, 10);

export function SiteFooter() {
  const { t } = useTranslation();

  const columns = [
    {
      heading: t("footer.quickLinks"),
      links: [
        { label: t("nav.services"), href: "/services" },
        { label: t("nav.track"), href: "/track" },
        { label: t("footer.help"), href: "/help" },
        { label: t("footer.sitemap"), href: "/sitemap" },
      ],
    },
    {
      heading: t("footer.policies"),
      links: [
        { label: t("footer.privacy"), href: "/privacy" },
        { label: t("footer.terms"), href: "/terms" },
        { label: t("footer.accessibility"), href: "/accessibility" },
        { label: t("footer.rti"), href: "/rti" },
      ],
    },
    {
      heading: t("footer.contact"),
      links: [
        { label: t("footer.grievance"), href: "/grievance" },
        { label: "support@setugov.gov.in", href: "mailto:support@setugov.gov.in" },
        { label: "1800-XXX-XXXX", href: "tel:1800" },
      ],
    },
  ];

  return (
    <footer className="gov-footer">
      <div className="gov-container">
        <div className="gov-footer__grid">
          <div>
            <h2>{t("footer.about")}</h2>
            <p className="max-w-xs leading-relaxed opacity-90">{t("footer.aboutText")}</p>
          </div>
          {columns.map(col => (
            <div key={col.heading}>
              <h2>{col.heading}</h2>
              <ul>
                {col.links.map(link => (
                  <li key={link.href}>
                    {link.href.startsWith("mailto:") || link.href.startsWith("tel:") ? (
                      <a href={link.href}>{link.label}</a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="gov-tricolour" aria-hidden />
      <div className="gov-container">
        <div className="gov-footer__bar">
          <span>{t("footer.managedBy")}</span>
          <span>{t("footer.developedBy")}</span>
          <span>
            {t("footer.lastUpdated")}: {BUILD_DATE}
          </span>
        </div>
        <div className="gov-footer__bar" style={{ borderTop: 0, paddingTop: 0 }}>
          <span>{t("footer.copyright")}</span>
          <span>{t("footer.bestViewed")}</span>
        </div>
      </div>
    </footer>
  );
}
