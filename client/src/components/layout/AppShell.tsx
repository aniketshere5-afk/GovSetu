import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { IdentificationBar } from "./IdentificationBar";
import { MainNav } from "./MainNav";
import { Masthead } from "./Masthead";
import { SiteFooter } from "./SiteFooter";

export function AppShell({
  children,
  breadcrumbs = [],
  bleed = false,
}: {
  children: ReactNode;
  breadcrumbs?: Crumb[];
  /** When true, children control their own full-width bands (e.g. the home banner). */
  bleed?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <IdentificationBar />
      <Masthead />
      <MainNav />
      <Breadcrumbs trail={breadcrumbs} />
      <main id="main" className="flex-1">
        {bleed ? children : (
          <div className="gov-container" style={{ paddingBlock: "24px 40px" }}>
            {children}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
