"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePurchases } from "@/contexts/PurchasesContext";
import { useAuth } from "@/contexts/AuthContext";
import { localAnalytics } from "@/lib/analytics";
import { useLocaleSync } from "@/hooks/useLocaleSync";
import { Check } from "@phosphor-icons/react";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";

export default function PricingPage() {
  const t = useTranslations("pricing");
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const { user, isAnonymous, loading: authLoading } = useAuth();
  useLocaleSync();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"monthly" | "yearly">("yearly");
  const {
    purchaseSubscription,
    isPurchasesLoading,
    isUserPremium,
    subscriptionTier,
    billingPeriod: currentBillingPeriod,
    managementUrl,
    openManagementPortal,
  } = usePurchases();

  const isAuthenticated = user && !isAnonymous;

  useEffect(() => {
    localAnalytics().logEvent("PricingPageViewed", {
      timestamp: Date.now(),
      isUserPremium,
    });
  }, [isUserPremium]);

  const handleSelectPlan = async (tier: string) => {
    if (!isAuthenticated) {
      router.push(`/auth/signup?redirect=/${locale}/pricing`);
      return;
    }

    setIsLoading(true);
    try {
      await purchaseSubscription(tier);
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb]">
      <PublicHeader variant="landing" />

      <main className="pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-[#1f1915] mb-4">
              {t("title")}
            </h1>
            <p className="text-lg text-[#5c4a3a] max-w-2xl mx-auto">
              {t("subtitle")}
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setActiveTab("monthly")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "monthly"
                  ? "bg-[#f96d4d] text-white"
                  : "bg-white text-[#5c4a3a] border border-[#e8dfd4]"
              }`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setActiveTab("yearly")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "yearly"
                  ? "bg-[#f96d4d] text-white"
                  : "bg-white text-[#5c4a3a] border border-[#e8dfd4]"
              }`}
            >
              {t("yearly")}
            </button>
          </div>

          {/* Pricing Cards Placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* TODO: Add pricing cards */}
            <div className="bg-white rounded-2xl border border-[#e8dfd4] p-8 text-center">
              <h3 className="text-xl font-bold text-[#1f1915] mb-2">{t("freeTier")}</h3>
              <p className="text-[#5c4a3a] mb-6">{t("freeDescription")}</p>
              <div className="text-4xl font-bold text-[#1f1915] mb-6">$0</div>
              <button
                onClick={() => handleSelectPlan("free")}
                className="w-full py-3 px-4 rounded-lg border border-[#e8dfd4] text-[#5c4a3a] font-medium hover:bg-[#fff5f3] transition-colors"
              >
                {t("getStarted")}
              </button>
            </div>

            <div className="bg-white rounded-2xl border-2 border-[#f96d4d] p-8 text-center relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#f96d4d] text-white text-sm font-medium px-4 py-1 rounded-full">
                {t("popular")}
              </div>
              <h3 className="text-xl font-bold text-[#1f1915] mb-2">{t("proTier")}</h3>
              <p className="text-[#5c4a3a] mb-6">{t("proDescription")}</p>
              <div className="text-4xl font-bold text-[#1f1915] mb-6">
                {t("proPrice")}
              </div>
              <button
                onClick={() => handleSelectPlan("pro")}
                disabled={isLoading || isPurchasesLoading}
                className="w-full py-3 px-4 rounded-lg bg-[#f96d4d] text-white font-semibold hover:bg-[#e6502f] transition-colors shadow-lg disabled:opacity-50"
              >
                {t("subscribe")}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#e8dfd4] p-8 text-center">
              <h3 className="text-xl font-bold text-[#1f1915] mb-2">{t("ultraTier")}</h3>
              <p className="text-[#5c4a3a] mb-6">{t("ultraDescription")}</p>
              <div className="text-4xl font-bold text-[#1f1915] mb-6">
                {t("ultraPrice")}
              </div>
              <button
                onClick={() => handleSelectPlan("ultra")}
                disabled={isLoading || isPurchasesLoading}
                className="w-full py-3 px-4 rounded-lg border border-[#e8dfd4] text-[#5c4a3a] font-medium hover:bg-[#fff5f3] transition-colors disabled:opacity-50"
              >
                {t("subscribe")}
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
