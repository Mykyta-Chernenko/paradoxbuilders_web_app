"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Eye,
  EyeSlash,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { localAnalytics } from "@/lib/analytics";
import { logErrorsWithMessage } from "@/lib/errors";
import toast from "react-hot-toast";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      if (typeof window === "undefined") return;

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const error = hashParams.get("error");
      const errorCode = hashParams.get("error_code");
      const errorDescription = hashParams.get("error_description");

      localAnalytics().logEvent("ResetPasswordPageVisit", {
        error,
        errorCode,
        errorDescription,
      });

      if (error) {
        setErrorType(errorCode || "unknown");
        localAnalytics().logEvent("ResetPasswordLinkError", {
          error,
          errorCode,
          errorDescription,
        });
        setIsCheckingSession(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setIsValidSession(true);
          localAnalytics().logEvent("ResetPasswordValidSession", {
            userId: session.user.id,
          });
        } else {
          setErrorType("invalid_link");
          localAnalytics().logEvent("ResetPasswordNoSession", {});
        }
      } catch (error) {
        setErrorType("invalid_link");
        localAnalytics().logEvent("ResetPasswordSessionCheckError", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setPasswordError("");
    setConfirmPasswordError("");
    setFormError("");

    let hasError = false;

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
      localAnalytics().logEvent("ResetPasswordSubmit", {});

      const { error } = await updatePassword(password);

      if (error) {
        if (error.message.includes("weak password")) {
          setPasswordError(t("weakPassword"));
        } else if (error.message.includes("same password")) {
          setPasswordError(t("passwordMinLength"));
        } else {
          setFormError(t("genericError"));
          logErrorsWithMessage(error, t("passwordUpdateFailed"));
        }
        localAnalytics().logEvent("ResetPasswordError", {
          error: error.message,
        });
      } else {
        toast.success(t("passwordUpdatedSuccessfully"));
        localAnalytics().logEvent("ResetPasswordSuccess", {});
        setTimeout(() => router.push("/auth/login"), 1500);
      }
    } catch (error) {
      setFormError(t("networkError"));
      logErrorsWithMessage(error, t("passwordUpdateFailed"));
      localAnalytics().logEvent("ResetPasswordException", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (errorType) {
    let errorTitle = t("invalidResetPasswordLink");
    let errorDesc = t("forgotPasswordDescription");
    const ErrorIcon = WarningCircle;

    if (errorType === "otp_expired") {
      errorTitle = t("resetLinkExpired");
      errorDesc = t("resetLinkExpiredDescription");
    }

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
                  <ErrorIcon className="w-8 h-8 text-[#f96d4d]" weight="bold" />
                </div>
                <h2 className="text-2xl font-bold text-[#1f1915] mb-3">
                  {errorTitle}
                </h2>
                <p className="text-[#5c4a3a] mb-8">{errorDesc}</p>
                <div className="space-y-3">
                  <Link
                    href="/auth/forgot-password"
                    className="block w-full bg-[#f96d4d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#e6502f] transition-colors shadow-lg"
                  >
                    {t("requestNewLink")}
                  </Link>
                  <Link
                    href="/auth/login"
                    className="block w-full text-center text-sm text-[#5c4a3a] hover:text-[#1f1915] transition-colors"
                  >
                    {t("backToLogin")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-[#fdfcfb]">
        <PublicHeader variant="auth" />
        <section className="relative pt-32 pb-12 md:pt-40 md:pb-16 min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute top-20 right-0 w-96 h-96 bg-[#fff5f3] rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#f3ede6] rounded-full blur-3xl opacity-60" />

          <div className="relative w-full max-w-md px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-[#e8dfd4] p-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#fff5f3] border border-[#ffd5cc] flex items-center justify-center animate-pulse">
                  <CheckCircle
                    className="w-8 h-8 text-[#f96d4d]"
                    weight="bold"
                  />
                </div>
                <p className="text-[#5c4a3a]">{t("loading")}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!isValidSession) {
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
                  <WarningCircle
                    className="w-8 h-8 text-[#f96d4d]"
                    weight="bold"
                  />
                </div>
                <h2 className="text-2xl font-bold text-[#1f1915] mb-3">
                  {t("invalidResetPasswordLink")}
                </h2>
                <p className="text-[#5c4a3a] mb-8">
                  {t("forgotPasswordDescription")}
                </p>
                <div className="space-y-3">
                  <Link
                    href="/auth/forgot-password"
                    className="block w-full bg-[#f96d4d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#e6502f] transition-colors shadow-lg"
                  >
                    {t("requestNewLink")}
                  </Link>
                  <Link
                    href="/auth/login"
                    className="block w-full text-center text-sm text-[#5c4a3a] hover:text-[#1f1915] transition-colors"
                  >
                    {t("backToLogin")}
                  </Link>
                </div>
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
                {t("resetPassword")}
              </h1>
              <p className="text-[#5c4a3a] text-sm mt-2 text-center">
                {t("resetPasswordDescription")}
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
                  htmlFor="password"
                  className="block text-sm font-medium text-[#1f1915] mb-2"
                >
                  {t("newPassword")}
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
                  {t("confirmNewPassword")}
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#f96d4d] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#e6502f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {loading ? t("loading") : t("updatePassword")}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
