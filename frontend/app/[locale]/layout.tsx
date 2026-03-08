import { LOCALES, Locale } from "@/i18n";
import { loadMessages, Messages } from "@/lib/messages";
import { Metadata } from "next";
import LocaleSyncWrapper from "./LocaleSyncWrapper";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = LOCALES.includes(locale as Locale) ? locale : "en";
  const messages: Messages = await loadMessages(validLocale);
  const seo = messages.seo;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  return (
    <LocaleSyncWrapper params={Promise.resolve(resolvedParams)}>
      {children}
    </LocaleSyncWrapper>
  );
}
