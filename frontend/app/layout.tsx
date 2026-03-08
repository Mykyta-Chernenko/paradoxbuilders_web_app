"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Toaster } from "react-hot-toast";
import { UnifiedTrackingInitializer } from "@/lib/unifiedTracking";
import { AuthProvider } from "@/contexts/AuthContext";
import { PurchasesProvider } from "@/contexts/PurchasesContext";
import { PaidPageProvider } from "@/contexts/PaidPageContext";
import { LocaleProvider, LOCALE_CHANGE_EVENT } from "@/contexts/LocaleContext";
import { getLocale } from "@/lib/locale";
import { loadMessages } from "@/lib/messages";
import { LOCALES, Locale } from "@/i18n";
import "./[locale]/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, setMessages] = useState<object | undefined>(undefined);
  const [locale, setLocale] = useState("en");
  const pathname = usePathname();

  const pathnameLocale = pathname?.split("/")[1];
  const isValidLocale =
    pathnameLocale && LOCALES.includes(pathnameLocale as Locale);

  useEffect(() => {
    const loadMessagesAsync = async () => {
      const targetLocale = isValidLocale ? pathnameLocale : getLocale();
      setLocale(targetLocale);
      const msgs = await loadMessages(targetLocale);
      setMessages(msgs);
    };
    loadMessagesAsync();
  }, [isValidLocale, pathnameLocale]);

  useEffect(() => {
    const handleLocaleChange = async (event: Event) => {
      const customEvent = event as CustomEvent<{ locale: string }>;
      const newLocale = customEvent.detail.locale;
      setLocale(newLocale);
      const msgs = await loadMessages(newLocale);
      setMessages(msgs);
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
    return () =>
      window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
  }, []);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {messages ? (
          <NextIntlClientProvider messages={messages} locale={locale}>
            <UnifiedTrackingInitializer />
            <AuthProvider>
              <PurchasesProvider>
                <PaidPageProvider>
                  <LocaleProvider>
                    <Toaster position="top-right" />
                    {children}
                  </LocaleProvider>
                </PaidPageProvider>
              </PurchasesProvider>
            </AuthProvider>
          </NextIntlClientProvider>
        ) : (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-pulse">Loading...</div>
          </div>
        )}
      </body>
    </html>
  );
}
