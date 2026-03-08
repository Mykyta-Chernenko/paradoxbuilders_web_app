"use client";

import Link from "next/link";
import { House } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-[#fdfcfb] flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#fdfcfb]/90 backdrop-blur-md border-b border-[#e8dfd4]">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/en" className="flex items-center gap-2">
              <Logo />
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl mx-auto">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 bg-[#fff5f3] rounded-full blur-3xl opacity-60" />
            </div>
            <div className="relative">
              <div className="text-[180px] sm:text-[220px] font-bold text-[#f96d4d] leading-none select-none opacity-20">
                404
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-[#fff5f3] border-2 border-[#ffd5cc] flex items-center justify-center">
                  <House className="w-16 h-16 text-[#f96d4d]" weight="duotone" />
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1f1915] mb-4">
            {t("notFound.heading")}
          </h1>

          <p className="text-lg text-[#5c4a3a] mb-10 max-w-md mx-auto">
            {t("notFound.description")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/en"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-[#f96d4d] text-white font-semibold hover:bg-[#e6502f] transition-colors shadow-lg"
            >
              <House className="w-5 h-5" weight="bold" />
              {t("notFound.backHome")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
