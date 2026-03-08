"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import { logErrorsWithoutAlert } from "@/lib/errors";

type SubscriptionStatus = "loading" | "subscribed" | "unsubscribed" | "not_found" | "error";

export default function UnsubscribePage() {
  const t = useTranslations("unsubscribe");
  const params = useParams();
  const userId = decodeURIComponent(params.userId as string);

  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [isResubscribing, setIsResubscribing] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [userId]);

  const invokeUnsubscribeFunction = async (body: Record<string, unknown>) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/unsubscribe-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      throw new Error(`unsubscribe-email returned ${response.status}`);
    }
    return response.json();
  };

  const checkSubscriptionStatus = async () => {
    try {
      const data = await invokeUnsubscribeFunction({ user_id: userId, action: "check" });

      if (data.status === "not_found") {
        setStatus("not_found");
      } else if (data.status === "subscribed") {
        setStatus("subscribed");
      } else if (data.status === "unsubscribed") {
        setStatus("unsubscribed");
      } else {
        setStatus("error");
      }
    } catch (err) {
      logErrorsWithoutAlert(err, "Failed to check subscription status");
      setStatus("error");
    }
  };

  const handleUnsubscribe = useCallback(async () => {
    setIsUnsubscribing(true);
    try {
      const data = await invokeUnsubscribeFunction({ user_id: userId, action: "unsubscribe" });

      if (!data.success) {
        logErrorsWithoutAlert(new Error("Unsubscribe failed"), "Failed to unsubscribe user");
        setStatus("error");
        return;
      }

      setStatus("unsubscribed");
    } catch (err) {
      logErrorsWithoutAlert(err, "Failed to unsubscribe user");
      setStatus("error");
    } finally {
      setIsUnsubscribing(false);
    }
  }, [userId]);

  const handleResubscribe = useCallback(async () => {
    setIsResubscribing(true);
    try {
      const data = await invokeUnsubscribeFunction({ user_id: userId, action: "resubscribe" });

      if (!data.success) {
        logErrorsWithoutAlert(new Error("Resubscribe failed"), "Failed to resubscribe user");
        setStatus("error");
        return;
      }

      setStatus("subscribed");
    } catch (err) {
      logErrorsWithoutAlert(err, "Failed to resubscribe user");
      setStatus("error");
    } finally {
      setIsResubscribing(false);
    }
  }, [userId]);

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f96d4d] mx-auto mb-4"></div>
            <p className="text-[#5c4a3a]">{t("loading")}</p>
          </div>
        );

      case "subscribed":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-[#fff5f0] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[#f96d4d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#1f1915] mb-4">{t("subscribedTitle")}</h2>
            <p className="text-[#5c4a3a] mb-8">{t("subscribedDescription")}</p>
            <button
              onClick={handleUnsubscribe}
              disabled={isUnsubscribing}
              className="px-6 py-3 bg-[#f96d4d] text-white rounded-lg font-medium hover:bg-[#e55a3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUnsubscribing ? t("unsubscribing") : t("unsubscribeButton")}
            </button>
          </div>
        );

      case "unsubscribed":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#1f1915] mb-4">{t("unsubscribedTitle")}</h2>
            <p className="text-[#5c4a3a] mb-8">{t("unsubscribedDescription")}</p>
            <button
              onClick={handleResubscribe}
              disabled={isResubscribing}
              className="px-6 py-3 border border-[#e8dfd4] text-[#5c4a3a] rounded-lg font-medium hover:bg-[#fff5f0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResubscribing ? t("resubscribing") : t("resubscribeButton")}
            </button>
          </div>
        );

      case "not_found":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#1f1915] mb-4">{t("notFoundTitle")}</h2>
            <p className="text-[#5c4a3a]">{t("notFoundDescription")}</p>
          </div>
        );

      case "error":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#1f1915] mb-4">{t("errorTitle")}</h2>
            <p className="text-[#5c4a3a]">{t("errorDescription")}</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb]">
      <PublicHeader variant="landing" />

      <main className="pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-[#1f1915] mb-4">
              {t("title")}
            </h1>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8dfd4] p-8">
            {renderContent()}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
