"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { supabase } from "@/lib/supabase";
import { localAnalytics } from "@/lib/analytics";
import { APP_VERSION } from "@/lib/constants";
import { getLocale } from "@/lib/locale";
import { getUtmParams, getGclid } from "@/lib/googleTracking";

interface AuthContextType {
  user: User | null;
  userId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  isCampaign: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectUrl?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signInAnonymously: () => Promise<string | null>;
  updateUserLanguage: (locale: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export function isMetaInAppBrowser(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "" // node-safe default
) {
  const s = ua.toLowerCase();

  // core facebook in-app markers
  if (s.includes("fb_iab") || s.includes("fban") || s.includes("fbav"))
    return true;

  // other meta properties
  if (
    s.includes("instagram") ||
    s.includes("messenger") ||
    s.includes("whatsapp") ||
    s.includes("threads") ||
    s.includes("barcelona")
  )
    return true;

  return false;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [noFbc, setNoFbc] = useState(false);

  const isAnonymous = user !== null && !!user.is_anonymous;
  const isAuthenticated = user !== null;
  const isCampaign = isMetaInAppBrowser();

  const fetchAndStoreFbc = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_technical_details")
        .select("fbc")
        .eq("user_id", userId)
        .single();

      if (error) {
        throw error;
      }

      if (data?.fbc) {
        localStorage.setItem("originalFbc", data.fbc);
      } else {
        setNoFbc(true);
      }
    } catch (error) {
      console.error("Error fetching fbc from user_technical_details:", error);
    }
  };

  const getBrowserInfo = () => {
    const locale = getLocale();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    let country = null;
    try {
      if ("geolocation" in navigator) {
        country = locale.split("-")[1]?.toUpperCase() || null;
      }
    } catch (error) {
      console.log("Could not detect country");
    }

    return {
      locale,
      timezone,
      country,
      platform: "web",
      appVersion: APP_VERSION,
    };
  };

  const handlePostAuthActions = async (userId: string, user?: User) => {
    const browserInfo = getBrowserInfo();

    if (user?.user_metadata?.full_name || user?.user_metadata?.name) {
      const name = user.user_metadata.full_name || user.user_metadata.name;
      try {
        await supabase
          .from("user_profile")
          .update({ name })
          .eq("user_id", userId);
      } catch (error) {
        console.error("Error saving user name:", error);
      }
    }

    const updateUserDetails = async (attempt = 1): Promise<void> => {
      try {
        if ((window as any).getFbc && (window as any).getFbc()) {
          const fbc: string = (window as any).getFbc();
          const { error: fbcError } = await supabase
            .from("user_technical_details")
            .update({
              fbc: fbc,
            })
            .eq("user_id", userId);
          if (fbcError) {
            throw fbcError;
          }
        }

        const utmParams = getUtmParams();
        const gclid = getGclid();

        const { error } = await supabase
          .from("user_technical_details")
          .update({
            user_locale: browserInfo.locale,
            updated_at: new Date().toISOString(),
            user_timezone: browserInfo.timezone,
            user_country: browserInfo.country,
            app_version: browserInfo.appVersion,
            platform: browserInfo.platform,
            ...utmParams,
            ...(gclid && { gclid }),
          })
          .eq("user_id", userId);

        if (error) {
          throw error;
        }

        localAnalytics().logEvent("UserTechnicalDetailsUpdated", {
          userId,
          attempt,
          ...browserInfo,
        });
      } catch (error) {
        console.error(
          `Error updating user technical details (attempt ${attempt}):`,
          error
        );

        if (attempt < 3) {
          localAnalytics().logEvent("UserTechnicalDetailsUpdateRetry", {
            userId,
            attempt,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));
          await updateUserDetails(attempt + 1);
        } else {
          localAnalytics().logEvent("UserTechnicalDetailsUpdateFailed", {
            userId,
            finalAttempt: attempt,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    };

    await updateUserDetails();
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);

        if (session?.user) {
          Sentry.setUser({ id: session.user.id });

          localAnalytics().identify(session.user.id);
          (window as any).userId = session.user.id;

          localAnalytics().logEvent("AuthSessionRestored", {
            userId: session.user.id,
          });

          await handlePostAuthActions(session.user.id, session.user);
        }
      } catch (error) {
        console.error("Error checking auth session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (_event === "SIGNED_IN" && session?.user) {
        Sentry.setUser({ id: session.user.id });

        localAnalytics().identify(session.user.id);
        (window as any).userId = session.user.id;

        localAnalytics().logEvent("AuthSignedIn", {
          userId: session.user.id,
        });
        handlePostAuthActions(session.user.id, session.user);
      } else if (_event === "SIGNED_OUT") {
        Sentry.setUser(null);

        localAnalytics().reset();

        localAnalytics().logEvent("AuthSignedOut", {});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.id) {
      const existingFbc =
        localStorage.getItem("fbc") || localStorage.getItem("originalFbc");
      if (!existingFbc && !noFbc) {
        fetchAndStoreFbc(user.id);
      }
    }
  }, [user?.id, noFbc]);

  const signIn = async (email: string, password: string) => {
    try {
      localAnalytics().logEvent("AuthSignInAttempt", { email });

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        localAnalytics().logEvent("AuthSignInError", {
          email,
          error: error.message,
        });
        return { error };
      }

      localAnalytics().logEvent("AuthSignInSuccess", { email });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await handlePostAuthActions(session.user.id, session.user);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      localAnalytics().logEvent("AuthSignUpAttempt", { email, isAnonymous });

      if (isAnonymous && user) {
        const { error: updateError } = await supabase.auth.updateUser({
          email: email.trim(),
          password: password.trim(),
        });

        if (updateError) {
          console.error("Error updating user:", updateError);
          localAnalytics().logEvent("AuthUpdateUserError", {
            email,
            error: updateError.message,
          });

          if (
            updateError.message.includes(
              "email address has already been registered"
            )
          ) {
            return { error: new Error("account_already_exists") };
          } else if (updateError.message.includes("Invalid email")) {
            return { error: new Error("invalid_email") };
          } else if (updateError.message.includes("Password")) {
            return { error: new Error("password_too_short") };
          } else {
            return { error: new Error("update_failed") };
          }
        } else {
          const {
            data: { user: updatedUser },
            error: signInError,
          } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });

          if (!updatedUser) {
            console.error("No user after signUp call");
            localAnalytics().logEvent("NoUserAfterSignUp", {
              error: signInError,
            });
            return { error: new Error("no_user_after_signup") };
          }

          if (name) {
            await supabase
              .from("user_profile")
              .update({ name: name.trim() })
              .eq("user_id", updatedUser.id);
          }

          localAnalytics().logEvent("AuthUpdateUserSuccess", {
            email: email,
            userId: updatedUser.id,
          });

          return { error: null };
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          localAnalytics().logEvent("AuthSignUpError", {
            email,
            error: error.message,
          });
          return { error };
        }

        if (name && data.user) {
          await supabase
            .from("user_profile")
            .update({ name: name.trim() })
            .eq("user_id", data.user.id);
        }

        localAnalytics().logEvent("AuthSignUpSuccess", { email });
        return { error: null };
      }
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async (redirectUrl?: string) => {
    try {
      localAnalytics().logEvent("AuthGoogleSignInAttempt", {});

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl
            ? `${window.location.origin}${redirectUrl}`
            : `${window.location.origin}/app`,
        },
      });

      if (error) {
        localAnalytics().logEvent("AuthGoogleSignInError", {
          error: error.message,
        });
        return { error };
      }

      localAnalytics().logEvent("AuthGoogleSignInSuccess", {});
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    localAnalytics().logEvent("AuthSignOutAttempt", {});

    const { error } = await supabase.auth.signOut();

    if (error && error.message !== "Auth session missing!") {
      localAnalytics().logEvent("AuthSignOutError", {
        error: error.message,
      });
    }

    Sentry.setUser(null);
    localAnalytics().reset();
    localAnalytics().logEvent("AuthSignOutSuccess", {});
  };

  const resetPassword = async (email: string) => {
    try {
      localAnalytics().logEvent("AuthResetPasswordAttempt", { email });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        localAnalytics().logEvent("AuthResetPasswordError", {
          email,
          error: error.message,
        });
        return { error };
      }

      localAnalytics().logEvent("AuthResetPasswordSuccess", { email });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      localAnalytics().logEvent("AuthUpdatePasswordAttempt", {});

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        localAnalytics().logEvent("AuthUpdatePasswordError", {
          error: error.message,
        });
        return { error };
      }

      localAnalytics().logEvent("AuthUpdatePasswordSuccess", {});
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInAnonymously = async (): Promise<string | null> => {
    try {
      localAnalytics().logEvent("AuthAnonymousSignInAttempt", {});

      const {
        data: { user: anonymousUser },
        error: authError,
      } = await supabase.auth.signInAnonymously();

      if (authError || !anonymousUser) {
        localAnalytics().logEvent("AuthAnonymousSignInError", {
          error: authError?.message,
        });
        throw new Error("Failed to create anonymous session");
      }

      localAnalytics().logEvent("AuthAnonymousSignInSuccess", {
        userId: anonymousUser.id,
      });

      return anonymousUser.id;
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      return null;
    }
  };

  const updateUserLanguage = async (locale: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_technical_details")
        .update({
          language: locale,
          user_locale: locale,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating user language:", error);
      } else {
        localAnalytics().logEvent("UserLanguageUpdated", {
          userId: user.id,
          locale,
        });
      }
    } catch (error) {
      console.error("Error updating user language:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id ?? null,
        loading,
        isAuthenticated,
        isCampaign,
        isAnonymous,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        signInAnonymously,
        updateUserLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
