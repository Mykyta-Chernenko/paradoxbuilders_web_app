"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Eye,
  EyeSlash,
  GoogleLogo,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { localAnalytics } from "@/lib/analytics";
import { logErrorsWithMessage } from "@/lib/errors";
import { PublicHeader } from "@/components/PublicHeader";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const { signIn, signInWithGoogle, isAnonymous } = useAuth();

  const redirectParam = searchParams.get("redirect") || "";
  const redirectUrl =
    redirectParam ? decodeURIComponent(redirectParam)
      : "/app";
  const isPricingRedirect = redirectUrl.includes("pricing");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    localAnalytics().logEvent("LoginPageViewed", {
      hasRedirect: !!redirectParam,
    });
  }, [redirectParam]);

  const handleGoogleLogin = async () => {
    try {
      localAnalytics().logEvent("GoogleLoginAttempt", {});
      const { error } = await signInWithGoogle(redirectUrl);
      if (error) {
        localAnalytics().logEvent("GoogleLoginError", {
          error: error.message,
        });
        logErrorsWithMessage(error, t("authenticationFailed"));
      }
    } catch (error) {
      logErrorsWithMessage(error, t("authenticationFailed"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setEmailError("");
    setPasswordError("");
    setFormError("");

    let hasError = false;

    if (!email) {
      setEmailError(t("emailRequired"));
      hasError = true;
    } else if (!email.includes("@") || !email.includes(".")) {
      setEmailError(t("emailFormatError"));
      hasError = true;
    }

    if (!password) {
      setPasswordError(t("passwordMinLength"));
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError(t("invalidPasswordFormat"));
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      localAnalytics().logEvent("EmailLoginAttempt", { email });

      const { error } = await signIn(email, password);

      if (error) {
        localAnalytics().logEvent("EmailLoginError", {
          email,
          error: error.message,
        });

        if (
          error.message.includes("Invalid login credentials") ||
          error.message.includes("invalid_credentials")
        ) {
          setFormError(t("invalidCredentials"));
        } else if (error.message.includes("Email not confirmed")) {
          setFormError(t("emailRequired"));
        } else if (error.message.includes("User not found")) {
          setEmailError(t("userNotFound"));
        } else if (error.message.includes("Too many requests")) {
          setFormError(t("tooManyRequests"));
        } else {
          setFormError(t("genericError"));
          logErrorsWithMessage(error, t("loginFailed"));
        }
      } else {
        localAnalytics().logEvent("EmailLoginSuccess", { email });
      }
    } catch (error) {
      setFormError(t("networkError"));
      logErrorsWithMessage(error, t("authenticationFailed"));
    } finally {
      setLoading(false);
    }
  };

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
                {t("appName")}
              </h1>
              <p className="text-[#5c4a3a] text-sm mt-2 text-center">
                {isPricingRedirect ? t("loginDescriptionPricing") : t("loginDescription")}
              </p>
            </div>

            {!isAnonymous && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  type="button"
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[#e8dfd4] bg-white hover:bg-[#f9f6f3] transition-colors font-medium text-[#1f1915] mb-6"
                >
                  <GoogleLogo className="w-5 h-5" weight="bold" />
                  {t("continueWithGoogle")}
                </button>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#e8dfd4]"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-[#7d6550]">
                      {t("orContinueWith")}
                    </span>
                  </div>
                </div>
              </>
            )}

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

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[#1f1915] mb-2"
                >
                  {t("password")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError("");
                      setFormError("");
                    }}
                    className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                      passwordError
                        ? "border-red-300 focus:ring-red-500"
                        : "border-[#e8dfd4] focus:ring-[#f96d4d]"
                    } bg-white text-[#1f1915] placeholder-[#b8a088] focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d6550] hover:text-[#5c4a3a] transition-colors"
                    aria-label={
                      showPassword ? t("hidePassword") : t("showPassword")
                    }
                  >
                    {showPassword ? (
                      <EyeSlash className="w-5 h-5" weight="bold" />
                    ) : (
                      <Eye className="w-5 h-5" weight="bold" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <WarningCircle className="w-4 h-4" weight="fill" />
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-[#f96d4d] hover:text-[#e6502f] transition-colors"
                >
                  {t("forgotPasswordQuestion")}
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#f96d4d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#e6502f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {loading ? t("loading") : t("login")}
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-[#7d6550]">
                {t("dontHaveAccount")}{" "}
              </span>
              <Link
                href={redirectParam ? `/auth/signup?redirect=${redirectParam}` : "/auth/signup"}
                className="text-sm font-medium text-[#f96d4d] hover:text-[#e6502f] transition-colors"
              >
                {t("signup")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
