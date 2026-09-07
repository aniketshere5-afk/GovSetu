import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const { t } = useTranslation();
  if (trail.length === 0) return null;
  const items: Crumb[] = [{ label: t("nav.home"), href: "/" }, ...trail];

  return (
    <div className="gov-crumbs">
      <nav className="gov-container" aria-label="Breadcrumb">
        <ol>
          {items.map((crumb, i) => {
            const last = i === items.length - 1;
            return (
              <Fragment key={`${crumb.label}-${i}`}>
                <li aria-current={last ? "page" : undefined}>
                  {crumb.href && !last ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}
                </li>
                {!last && <li aria-hidden>›</li>}
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
