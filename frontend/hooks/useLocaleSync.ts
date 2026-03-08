"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { saveLocale, getLocale } from "@/lib/locale";
import { useAuth } from "@/contexts/AuthContext";

export function useLocaleSync() {
  const params = useParams();
  const locale = params.locale as string | undefined;
  const { updateUserLanguage } = useAuth();

  useEffect(() => {
    if (!locale) return;

    const savedLocale = getLocale();

    if (savedLocale !== locale) {
      saveLocale(locale);
      updateUserLanguage(locale);
    }
  }, [locale, updateUserLanguage]);
}
