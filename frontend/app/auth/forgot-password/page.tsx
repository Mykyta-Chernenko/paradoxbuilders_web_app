"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Envelope, ArrowLeft, WarningCircle } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { localAnalytics } from "@/lib/analytics";
import { logErrorsWithMessage } from "@/lib/errors";
import toast from "react-hot-toast";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    localAnalytics().logEvent("ForgotPasswordPageViewed", {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setEmailError("");
    setFormError("");

    if (!email) {
      setEmailError(t("emailRequired"));
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setEmailError(t("emailFormatError"));
      return;
    }

    setLoading(true);

    try {
      localAnalytics().logEvent("ForgotPasswordSubmit", { email });

      const { error } = await resetPassword(email);

      if (error) {
        if (error.message.includes("User not found")) {
          setEmailError(t("userNotFound"));
        } else if (error.message.includes("Too many requests")) {
          setFormError(t("tooManyRequests"));
        } else {
          setFormError(t("genericError"));
          logErrorsWithMessage(error, t("resetPasswordFailed"));
        }
        localAnalytics().logEvent("ForgotPasswordError", {
          email,
          error: error.message,
        });
      } else {
        setEmailSent(true);
        toast.success(t("resetPasswordEmailSent"));
        localAnalytics().logEvent("ForgotPasswordSuccess", { email });
      }
    } catch (error) {
      setFormError(t("networkError"));
      logErrorsWithMessage(error, t("resetPasswordFailed"));
      localAnalytics().logEvent("ForgotPasswordException", {
        email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-[#fdfcfb]">
        <PublicHeader variant="auth" />

        <section className="relative pt-32 pb-12 md:pt-40 md:pb-16 min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute top-20 right-0 w-96 h-96 bg-[#fff5f3] rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#f3ede6] rounded-full blur-3xl opacity-60" />

          <div className="relative w-full max-w-md px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-[#e8dfd4] p-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#fff5f3] border border-[#ffd5cc] flex items-center justify-center">
                  <Envelope className="w-8 h-8 text-[#f96d4d]" weight="bold" />
                </div>
                <h2 className="text-2xl font-bold text-[#1f1915] mb-3">
                  {t("resetPasswordEmailSent")}
                </h2>
                <p className="text-[#5c4a3a] mb-8">
                  {t("resetPasswordEmailSentDescription")}
                </p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center w-full bg-[#f96d4d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#e6502f] transition-colors shadow-lg"
                >
                  {t("backToLogin")}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfcfb]">
      <PublicHeader variant="auth" />

      <section className="relative pt-32 pb-12 md:pt-40 md:pb-16 min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute top-20 right-0 w-96 h-96 bg-[#fff5f3] rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#f3ede6] rounded-full blur-3xl opacity-60" />

        <div className="relative w-full max-w-md px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#e8dfd4] p-8">
            <div className="flex flex-col items-center mb-8">
              <Logo />
              <h1 className="text-3xl font-bold text-[#1f1915] mt-4">
                {t("forgotPassword")}
              </h1>
              <p className="text-[#5c4a3a] text-sm mt-2 text-center">
                {t("forgotPasswordDescription")}
              </p>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                <WarningCircle
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                  weight="fill"
                />
                <p className="text-sm text-red-800">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[#1f1915] mb-2"
                >
                  {t("email")}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                    setFormError("");
                  }}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    emailError
                      ? "border-red-300 focus:ring-red-500"
                      : "border-[#e8dfd4] focus:ring-[#f96d4d]"
                  } bg-white text-[#1f1915] placeholder-[#b8a088] focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                  placeholder="you@example.com"
                  required
                />
                {emailError && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <WarningCircle className="w-4 h-4" weight="fill" />
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#f96d4d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#e6502f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {loading ? t("loading") : t("sendResetLink")}
              </button>
            </form>

            <div className="mt-6">
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-2 text-sm text-[#5c4a3a] hover:text-[#1f1915] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" weight="bold" />
                {t("backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
