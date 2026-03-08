"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getLocale, saveLocale } from "@/lib/locale";
import { Locale } from "@/i18n";

export const LOCALE_CHANGE_EVENT = "locale-change";

interface LocaleContextType {
  locale: string;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>("en");

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  useEffect(() => {
    const handleLocaleChange = (event: CustomEvent<{ locale: string }>) => {
      setLocaleState(event.detail.locale);
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange as EventListener);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange as EventListener);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    saveLocale(newLocale);
    setLocaleState(newLocale);
    window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale: newLocale } }));
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocaleContext must be used within a LocaleProvider");
  }
  return context;
}
