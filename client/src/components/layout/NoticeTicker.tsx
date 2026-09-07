import { useTranslation } from "react-i18next";
import { Megaphone } from "lucide-react";

export function NoticeTicker() {
  const { t } = useTranslation();
  const notices = t("ticker.items", { returnObjects: true }) as string[];
  const list = Array.isArray(notices) ? notices : [];
  if (list.length === 0) return null;

  return (
    <div className="gov-ticker" role="region" aria-label={t("ticker.label")}>
      <span className="gov-ticker__tag">
        <Megaphone size={13} aria-hidden />
        {t("ticker.label")}
      </span>
      <div className="gov-ticker__viewport">
        <div className="gov-ticker__track">
          {[...list, ...list].map((item, i) => (
            <a key={i} href="/notices" aria-hidden={i >= list.length}>
              {item}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
