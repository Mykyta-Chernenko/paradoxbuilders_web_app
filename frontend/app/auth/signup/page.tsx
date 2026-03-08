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
import { useLocaleContext } from "@/contexts/LocaleContext";
import { localAnalytics } from "@/lib/analytics";
import { logErrorsWithMessage } from "@/lib/errors";
import { PublicHeader } from "@/components/PublicHeader";
import { Logo } from "@/components/Logo";

export default function SignupPage() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const { signUp, signInWithGoogle, isAnonymous } = useAuth();
  const { locale } = useLocaleContext();

  const prepopulatedEmail = searchParams.get("email") || "";
  const redirectParam = searchParams.get("redirect") || "";
  const redirectUrl =
    redirectParam ? decodeURIComponent(redirectParam)
      : "/app";
  const isPricingRedirect = redirectUrl.includes("pricing");

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prepopulatedEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [termsError, setTermsError] = useState("");

  useEffect(() => {
    localAnalytics().logEvent("SignupPageViewed", {
      hasPrepopulatedEmail: !!prepopulatedEmail,
      hasRedirect: !!redirectParam,
    });
  }, [prepopulatedEmail, redirectParam]);

  const handleGoogleSignup = async () => {
    try {
      localAnalytics().logEvent("GoogleSignupAttempt", {});
      const { error } = await signInWithGoogle(redirectUrl || undefined);
      if (error) {
        localAnalytics().logEvent("GoogleSignupError", {
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

    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setFormError("");
    setTermsError("");

    let hasError = false;

    if (!agreedToTerms) {
      setTermsError(t("mustAgreeToTerms"));
      hasError = true;
    }

    if (!name.trim()) {
      setNameError(t("nameRequired"));
      hasError = true;
    }

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

    if (!confirmPassword) {
      setConfirmPasswordError(t("passwordMinLength"));
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError(t("passwordMismatchError"));
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      localAnalytics().logEvent("EmailSignupAttempt", { email });

      const { error } = await signUp(email, password, name.trim());

      if (error) {
        if (error.message === "account_already_exists") {
          setEmailError(t("emailAlreadyInUse"));
        } else if (error.message === "invalid_email") {
          setEmailError(t("emailFormatError"));
        } else if (error.message === "password_too_short") {
          setPasswordError(t("invalidPasswordFormat"));
        } else if (
          error.message === "update_failed" ||
          error.message === "no_user_after_signup"
        ) {
          setFormError(t("signUpFailed"));
        } else if (
          error.message.includes("already registered") ||
          error.message.includes("already exists")
        ) {
          setEmailError(t("emailAlreadyInUse"));
        } else if (error.message.includes("weak password")) {
          setPasswordError(t("weakPassword"));
        } else if (error.message.includes("Too many requests")) {
          setFormError(t("tooManyRequests"));
        } else {
          setFormError(t("genericError"));
          logErrorsWithMessage(error, t("signUpFailed"));
        }

        localAnalytics().logEvent("EmailSignupError", {
          email,
          error: error.message,
        });
      } else {
        localAnalytics().logEvent("EmailSignupSuccess", { email });
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
                {isPricingRedirect ? t("signUpDescriptionPricing") : t("signUpDescription")}
              </p>
            </div>

            {!isAnonymous && (
              <>
                <button
                  onClick={handleGoogleSignup}
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
                  htmlFor="name"
                  className="block text-sm font-medium text-[#1f1915] mb-2"
                >
                  {t("name")}
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError("");
                    setFormError("");
                  }}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    nameError
                      ? "border-red-300 focus:ring-red-500"
                      : "border-[#e8dfd4] focus:ring-[#f96d4d]"
                  } bg-white text-[#1f1915] placeholder-[#b8a088] focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                  placeholder={t("namePlaceholder")}
                  required
                />
                {nameError && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <WarningCircle className="w-4 h-4" weight="fill" />
                    {nameError}
                  </p>
                )}
              </div>

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
                    autoComplete="new-password"
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

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-[#1f1915] mb-2"
                >
                  {t("confirmPassword")}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setConfirmPasswordError("");
                      setFormError("");
                    }}
                    className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                      confirmPasswordError
                        ? "border-red-300 focus:ring-red-500"
                        : "border-[#e8dfd4] focus:ring-[#f96d4d]"
                    } bg-white text-[#1f1915] placeholder-[#b8a088] focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7d6550] hover:text-[#5c4a3a] transition-colors"
                    aria-label={
                      showConfirmPassword
                        ? t("hidePassword")
                        : t("showPassword")
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeSlash className="w-5 h-5" weight="bold" />
                    ) : (
                      <Eye className="w-5 h-5" weight="bold" />
                    )}
                  </button>
                </div>
                {confirmPasswordError && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <WarningCircle className="w-4 h-4" weight="fill" />
                    {confirmPasswordError}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    setTermsError("");
                  }}
                  className="mt-1 h-4 w-4 rounded border-[#e8dfd4] text-[#f96d4d] focus:ring-[#f96d4d] cursor-pointer"
                />
                <label htmlFor="terms" className="text-sm text-[#5c4a3a] cursor-pointer">
                  {t("agreeToTerms")}{" "}
                  <Link
                    href={`/${locale}/terms-of-service`}
                    className="text-[#f96d4d] hover:text-[#e6502f] underline"
                    target="_blank"
                  >
                    {t("termsOfService")}
                  </Link>{" "}
                  {t("and")}{" "}
                  <Link
                    href={`/${locale}/privacy-policy`}
                    className="text-[#f96d4d] hover:text-[#e6502f] underline"
                    target="_blank"
                  >
                    {t("privacyPolicy")}
                  </Link>
                </label>
              </div>
              {termsError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <WarningCircle className="w-4 h-4" weight="fill" />
                  {termsError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#f96d4d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#e6502f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {loading ? t("loading") : t("createAccount")}
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-[#7d6550]">
                {t("alreadyHaveAccount")}{" "}
              </span>
              <Link
                href={redirectParam ? `/auth/login?redirect=${redirectParam}` : "/auth/login"}
                className="text-sm font-medium text-[#f96d4d] hover:text-[#e6502f] transition-colors"
              >
                {t("login")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
