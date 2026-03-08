import { MetadataRoute } from "next";
import { LOCALES } from "@/i18n";

const BASE_URL = "https://example.com"; // TODO: Replace with your domain

const DEFAULT_LOCALE = "en";

interface PageConfig {
  path: string;
  priority: number;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
}

const PAGES: PageConfig[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/pricing/", priority: 0.9, changeFrequency: "weekly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const sitemapEntries: MetadataRoute.Sitemap = [];

  for (const page of PAGES) {
    for (const locale of LOCALES) {
      let url: string;
      if (page.path === "/") {
        url = `${BASE_URL}/${locale}/`;
      } else {
        url = `${BASE_URL}/${locale}${page.path}`;
      }

      const alternates: Record<string, string> = {};
      for (const altLocale of LOCALES) {
        let altUrl: string;
        if (page.path === "/") {
          altUrl = `${BASE_URL}/${altLocale}/`;
        } else {
          altUrl = `${BASE_URL}/${altLocale}${page.path}`;
        }
        alternates[altLocale] = altUrl;
      }
      if (page.path === "/") {
        alternates["x-default"] = `${BASE_URL}/${DEFAULT_LOCALE}/`;
      } else {
        alternates["x-default"] = `${BASE_URL}/${DEFAULT_LOCALE}${page.path}`;
      }

      sitemapEntries.push({
        url,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: alternates,
        },
      });
    }
  }

  return sitemapEntries;
}
