import { Locale, LOCALES } from "@/i18n";

export interface SeoData {
  title: string;
  description: string;
  keywords: string;
}

export interface SectionWithSeo {
  seo: SeoData;
  [key: string]: unknown;
}

export interface Messages {
  seo: SeoData;
  [key: string]: unknown;
}

const PATH_TO_FILE_MAP: Record<string, string[]> = {
  "/": ["home"],
  "/pricing": ["pricing"],
  "/purchase-success": ["pricing"],
};

async function loadMarketingFile(
  locale: string,
  fileName: string
): Promise<Record<string, unknown>> {
  try {
    const imported = await import(
      `@/messages/marketing/${locale}/${fileName}.json`
    );
    return imported.default || {};
  } catch {
    if (locale !== "en") {
      try {
        const fallback = await import(
          `@/messages/marketing/en/${fileName}.json`
        );
        return fallback.default || {};
      } catch {
        return {};
      }
    }
    return {};
  }
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function getMarketingFilesForPath(pathname: string): string[] {
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?:\/|$)/, "/");
  const normalizedPath =
    pathWithoutLocale === "" ? "/" : pathWithoutLocale.replace(/\/$/, "");

  return PATH_TO_FILE_MAP[normalizedPath] || ["home"];
}

export async function loadMessages(
  locale: string,
  pathname?: string
): Promise<Messages> {
  const validLocale = LOCALES.includes(locale as Locale) ? locale : "en";

  let appMessages;
  try {
    appMessages = (await import(`@/messages/${validLocale}.json`)).default;
  } catch {
    appMessages = (await import(`@/messages/en.json`)).default;
  }

  const filesToLoad = ["shared"];
  if (pathname) {
    filesToLoad.push(...getMarketingFilesForPath(pathname));
  } else {
    filesToLoad.push("home", "pricing");
  }

  const marketingParts = await Promise.all(
    filesToLoad.map((file) => loadMarketingFile(validLocale, file))
  );

  const marketingMessages = marketingParts.reduce<Record<string, unknown>>(
    (acc, part) => deepMerge(acc, part),
    {}
  );

  return {
    ...appMessages,
    ...marketingMessages,
  } as Messages;
}
