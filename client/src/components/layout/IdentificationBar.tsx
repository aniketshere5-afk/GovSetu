import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { LanguageSelect } from "./LanguageSelect";
import { ThemeToggle } from "./ThemeToggle";
import { TextSizeControl } from "./TextSizeControl";

export function IdentificationBar() {
  const { t } = useTranslation();
  return (
    <>
      <div className="gov-tricolour" aria-hidden />
      <div className="gov-idbar">
        <div className="gov-container gov-idbar__inner">
          <div className="gov-idbar__links">
            <a href="#main">{t("idbar.skipToMain")}</a>
            <span className="gov-idbar__divider" aria-hidden />
            <Link href="/accessibility">{t("idbar.screenReader")}</Link>
          </div>
          <div className="gov-idbar__tools">
            <TextSizeControl />
            <LanguageSelect />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}
