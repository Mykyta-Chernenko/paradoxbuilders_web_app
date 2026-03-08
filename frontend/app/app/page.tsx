"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const t = useTranslations();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#fdfcfb]">
      <main className="pt-16 pb-16 md:pt-24 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#1f1915] mb-6">
            {t("dashboard.title")}
          </h1>
          <p className="text-[#5c4a3a]">
            {t("dashboard.welcome")}
          </p>
        </div>
      </main>
    </div>
  );
}
