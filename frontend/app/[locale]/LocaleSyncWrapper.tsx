"use client";

import { useEffect } from "react";
import { use } from "react";
import { LOCALES, type Locale } from "@/i18n";
import { saveLocale } from "@/lib/locale";

export default function LocaleSyncWrapper({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);

  useEffect(() => {
    if (locale && LOCALES.includes(locale as Locale)) {
      saveLocale(locale);
    }
  }, [locale]);

  return <>{children}</>;
}
