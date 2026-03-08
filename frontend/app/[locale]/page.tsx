"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  const t = useTranslations();
  const params = useParams();
  const locale = params.locale as string;

  return (
    <div className="min-h-screen bg-[#fdfcfb]">
      <PublicHeader variant="landing" />

      <main className="pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[#1f1915] mb-6">
              {t("home.hero.title")}
            </h1>
            <p className="text-lg sm:text-xl text-[#5c4a3a] mb-10 max-w-2xl mx-auto">
              {t("home.hero.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-[#f96d4d] text-white font-semibold hover:bg-[#e6502f] transition-colors shadow-lg"
              >
                {t("home.hero.cta")}
              </Link>
              <Link
                href={`/${locale || "en"}/pricing`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg border-2 border-[#e8dfd4] text-[#5c4a3a] font-semibold hover:border-[#ffd5cc] hover:bg-[#fff5f3] transition-colors"
              >
                {t("home.hero.ctaSecondary")}
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
