import { getRequestConfig } from "next-intl/server";
import { loadMessages } from "@/lib/messages";

export const LOCALES = ["en", "es", "de", "fr", "pt", "ja", "it", "no"] as const;
export type Locale = (typeof LOCALES)[number];

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "no", label: "Norsk", flag: "🇳🇴" },
];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !LOCALES.includes(locale as Locale)) {
    locale = "en";
  }

  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
  };
});
