import { Locale, LOCALES } from "@/i18n";

const LOCALE_STORAGE_KEY = "user_locale";
const DEFAULT_LOCALE = "en";

export function saveLocale(locale: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function getSavedLocale(): string | null {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
}

export function getLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const savedLocale = getSavedLocale();
  if (savedLocale) return savedLocale;

  const browserLocale = navigator.language.split("-")[0];

  return LOCALES.includes(browserLocale as Locale)
    ? browserLocale
    : DEFAULT_LOCALE;
}
