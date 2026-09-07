import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const KEY = "setugov.fontScale";
const STEPS = [0.9, 1, 1.1, 1.25];

/** GIGW text-resize widget: A- / A / A+ applied via the --font-scale token. */
export function TextSizeControl() {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(KEY));
      if (STEPS.includes(stored)) setScale(stored);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(scale));
    try {
      localStorage.setItem(KEY, String(scale));
    } catch {
      /* ignore */
    }
  }, [scale]);

  const idx = STEPS.indexOf(scale);
  return (
    <div className="gov-textsize" role="group" aria-label={t("idbar.textSize")}>
      <button type="button" onClick={() => setScale(STEPS[Math.max(0, idx - 1)])} aria-label={t("idbar.decreaseText")}>
        A-
      </button>
      <button type="button" onClick={() => setScale(1)} aria-label={t("idbar.resetText")} aria-pressed={scale === 1}>
        A
      </button>
      <button
        type="button"
        onClick={() => setScale(STEPS[Math.min(STEPS.length - 1, idx + 1)])}
        aria-label={t("idbar.increaseText")}
      >
        A+
      </button>
    </div>
  );
}
