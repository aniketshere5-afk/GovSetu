import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";

/**
 * Language support. English, Hindi and Marathi ship with full copy; the other
 * entries are scaffolded (they fall back to English until translated) so the
 * selector can already list the Eighth Schedule languages.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", native: "English", ready: true },
  { code: "hi", label: "Hindi", native: "हिन्दी", ready: true },
  { code: "mr", label: "Marathi", native: "मराठी", ready: true },
  { code: "bn", label: "Bengali", native: "বাংলা", ready: false },
  { code: "ta", label: "Tamil", native: "தமிழ்", ready: false },
  { code: "te", label: "Telugu", native: "తెలుగు", ready: false },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", ready: false },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", ready: false },
  { code: "ml", label: "Malayalam", native: "മലയാളം", ready: false },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", ready: false },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ", ready: false },
  { code: "ur", label: "Urdu", native: "اردو", ready: false },
] as const;

export const LANGUAGE_STORAGE_KEY = "setugov.lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

i18n.on("languageChanged", lng => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
    document.documentElement.dir = lng === "ur" ? "rtl" : "ltr";
  }
});

export default i18n;
