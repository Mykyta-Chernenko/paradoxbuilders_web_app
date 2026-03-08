"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Package, Purchases } from "@revenuecat/purchases-js";
import type { PurchaseParams } from "@revenuecat/purchases-js";
import { supabase } from "@/lib/supabase";
import { localAnalytics } from "@/lib/analytics";
import { logErrorsWithMessage } from "@/lib/errors";
import { useAuth } from "./AuthContext";
import { useRewardful } from "./RewardfulContext";
import { getUtmParams, getGclid } from "@/lib/googleTracking";

export interface PurchaseResult {
  success: boolean;
  error?: string;
  customerInfo?: unknown;
  redirectToSignup?: boolean;
  signupEmail?: string;
  redirectToDashboard?: boolean;
}

interface PurchasePackage {
  id: string;
  title: string;
  shortTitle: string;
  price: string;
  bonus: string;
  bonusAmount?: string;
  image: string;
}

interface PurchasesContextType {
  isInitialized: boolean;
  isPurchasesLoading: boolean;
  isUserStatusLoading: boolean;
  availablePackages: PurchasePackage[];
  formattedOfferings: PurchasePackage[];
  creditBalance: number;
  isUserPremium: boolean;
  subscriptionTier: "plus" | "pro" | null;
  billingPeriod: "monthly" | "yearly" | null;
  nextFreeUnlock: Date | null;
  nextChargeDate: Date | null;
  premiumFinish: Date | null;
  purchaseEmail: string | null;
  managementUrl: string | null;
  purchaseCredits: (productId: string) => Promise<PurchaseResult>;
  purchaseSubscription: (productId: string) => Promise<PurchaseResult>;
  purchaseCreditsGuest: (productId: string) => Promise<PurchaseResult>;
  purchaseSubscriptionGuest: (productId: string) => Promise<PurchaseResult>;
  refreshUserStatus: () => Promise<{
    creditBalance: number;
    isUserPremium: boolean;
    nextFreeUnlock: Date | null;
  }>;
  refreshPurchases: () => Promise<void>;
  fetchPremiumStatusAndEmail: (
    userId: string,
    maxRetries?: number,
    delay?: number
  ) => Promise<{ isPremium: boolean; purchaseEmail: string | null }>;
  openManagementPortal: () => void;
}

const PurchasesContext = createContext<PurchasesContextType | undefined>(
  undefined
);

export const usePurchases = () => {
  const context = useContext(PurchasesContext);
  if (!context) {
    throw new Error("usePurchases must be used within a PurchasesProvider");
  }
  return context;
};

export const PurchasesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPurchasesLoading, setIsPurchasesLoading] = useState(false);
  const [isUserStatusLoading, setIsUserStatusLoading] = useState(true);
  const [availablePackages, setAvailablePackages] = useState<PurchasePackage[]>(
    []
  );
  const [formattedOfferings, setFormattedOfferings] = useState<
    PurchasePackage[]
  >([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [isUserPremium, setIsUserPremium] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<"plus" | "pro" | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly" | null>(null);
  const [nextFreeUnlock, setNextFreeUnlock] = useState<Date | null>(null);
  const [nextChargeDate, setNextChargeDate] = useState<Date | null>(null);
  const [premiumFinish, setPremiumFinish] = useState<Date | null>(null);
  const [purchaseEmail, setPurchaseEmail] = useState<string | null>(null);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const { isAuthenticated, userId, signInAnonymously, isAnonymous } = useAuth();
  const { referralId } = useRewardful();

  const initialize = (userId: string): boolean => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY;
      if (!apiKey) {
        throw new Error("RevenueCat API key not configured");
      }

      Purchases.configure(apiKey, userId);
      setIsInitialized(true);
      console.log("Purchases SDK initialized for user:", userId);
      return true;
    } catch (error) {
      logErrorsWithMessage(error, "Failed to initialize Purchases SDK");
      return false;
    }
  };

  const fetchPackage = async (
    packageIdentifier: string
  ): Promise<Package | null> => {
    if (!Purchases.isConfigured()) {
      return null;
    }

    try {
      const offerings = await Purchases.getSharedInstance().getOfferings();

      for (const offeringKey in offerings.all) {
        const offering = offerings.all[offeringKey];
        const pkg = offering.availablePackages.find(
          (p: Package) => p.webBillingProduct.identifier === packageIdentifier
        );
        if (pkg) return pkg;
      }

      return null;
    } catch (error) {
      logErrorsWithMessage(error, "Failed to fetch package");
      return null;
    }
  };

  const getUserEmail = async (): Promise<string | null> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user?.email || null;
    } catch (error) {
      logErrorsWithMessage(error, "Failed to get user email from session");
      return null;
    }
  };

  const fetchPurchaseEmail = async (
    userId: string,
    maxRetries: number = 3,
    delay: number = 500
  ): Promise<string | null> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase
          .from("user_technical_details")
          .select("purchase_email")
          .eq("user_id", userId)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data?.purchase_email) {
          return data.purchase_email;
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        logErrorsWithMessage(
          error,
          `Failed to fetch purchase email (attempt ${attempt})`
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const initializePurchases = async () => {
      if (userId) {
        setIsUserStatusLoading(true);
        const initialized = initialize(userId);
        setIsInitialized(initialized);
        if (initialized) {
          await refreshPurchases();
        }
        setIsUserStatusLoading(false);
      } else {
        setIsInitialized(false);
        setIsUserStatusLoading(false);
      }
    };

    initializePurchases();
  }, [userId]);

  const retrieveAndSetPurchaseEmail = async (userId: string) => {
    const email = await fetchPurchaseEmail(userId);
    if (email) {
      setPurchaseEmail(email);
    }
  };

  useEffect(() => {
    const fetchEmail = async () => {
      if (userId && !purchaseEmail) {
        await retrieveAndSetPurchaseEmail(userId);
      }
    };
    fetchEmail();
  }, [userId]);

  const fetchUserStatusFromDB = async (targetUserId: string) => {
    const [userPremiumResult, isPremiumResult] = await Promise.all([
      supabase
        .from("user_premium")
        .select("credits, created_at, next_charge_date, premium_finish, subscription_tier, billing_period, has_purchased")
        .eq("user_id", targetUserId)
        .single(),
      supabase.rpc("is_user_premium"),
    ]);

    const { data, error } = userPremiumResult;
    const { data: isPremiumData, error: premiumError } = isPremiumResult;

    if (error) {
      throw error;
    }

    if (premiumError) {
      throw premiumError;
    }

    return {
      creditBalance: data?.credits || 0,
      isUserPremium: !!isPremiumData,
      nextChargeDate: data?.next_charge_date ? new Date(data.next_charge_date) : null,
      premiumFinish: data?.premium_finish ? new Date(data.premium_finish) : null,
      subscriptionTier: (data?.subscription_tier as "plus" | "pro" | null) || null,
      billingPeriod: (data?.billing_period as "monthly" | "yearly" | null) || null,
    };
  };

  const waitForUserStatusUpdate = async (
    targetUserId: string,
    condition: (status: {
      creditBalance: number;
      isUserPremium: boolean;
    }) => boolean,
    maxRetries: number = 10,
    delay: number = 500
  ) => {
    let status: {
      creditBalance: number;
      isUserPremium: boolean;
    } | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        status = await fetchUserStatusFromDB(targetUserId);
        if (condition(status)) {
          setCreditBalance(status.creditBalance);
          setIsUserPremium(status.isUserPremium);
          return status;
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        logErrorsWithMessage(
          error,
          `Failed to check user status (attempt ${attempt})`
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return status;
  };

  const fetchPremiumStatusAndEmail = async (
    targetUserId: string,
    maxRetries: number = 10,
    delay: number = 1000
  ): Promise<{ isPremium: boolean; purchaseEmail: string | null }> => {
    const startTime = Date.now();

    localAnalytics().logEvent("FetchPremiumStatusStarted", {
      userId: targetUserId,
      maxRetries,
      delay,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptStartTime = Date.now();

      localAnalytics().logEvent("FetchPremiumStatusAttempt", {
        userId: targetUserId,
        attempt,
        maxRetries,
      });

      try {
        const [premiumResult, emailResult] = await Promise.all([
          supabase.rpc("is_user_premium"),
          supabase
            .from("user_technical_details")
            .select("purchase_email")
            .eq("user_id", targetUserId)
            .single(),
        ]);

        const { data: isPremium, error: premiumError } = premiumResult;
        const { data: emailData, error: emailError } = emailResult;

        localAnalytics().logEvent("FetchPremiumStatusResponse", {
          userId: targetUserId,
          attempt,
          isPremium,
          hasPremiumError: !!premiumError,
          premiumErrorCode: premiumError?.code,
          premiumErrorMessage: premiumError?.message,
          hasEmailError: !!emailError,
          emailErrorCode: emailError?.code,
          emailErrorMessage: emailError?.message,
          hasEmailData: !!emailData?.purchase_email,
          attemptDuration: Date.now() - attemptStartTime,
        });

        if (premiumError) {
          console.error("Error checking premium status:", premiumError);
          localAnalytics().logEvent("FetchPremiumStatusError", {
            userId: targetUserId,
            attempt,
            error: premiumError.message,
            errorCode: premiumError.code,
            errorDetails: premiumError.details,
          });
          throw premiumError;
        }

        if (emailError && emailError.code !== "PGRST116") {
          console.error("Error fetching purchase email:", emailError);
          localAnalytics().logEvent("FetchPurchaseEmailError", {
            userId: targetUserId,
            attempt,
            error: emailError.message,
            errorCode: emailError.code,
            errorDetails: emailError.details,
          });
        }

        if (isPremium) {
          localAnalytics().logEvent("PremiumStatusAndEmailRetrieved", {
            userId: targetUserId,
            attempt,
            hasEmail: !!emailData?.purchase_email,
            totalDuration: Date.now() - startTime,
            finalAttemptDuration: Date.now() - attemptStartTime,
          });
          return {
            isPremium: true,
            purchaseEmail: emailData?.purchase_email || null,
          };
        }

        if (attempt < maxRetries) {
          localAnalytics().logEvent("PremiumStatusRetry", {
            userId: targetUserId,
            attempt,
            maxRetries,
            delayMs: delay,
            attemptDuration: Date.now() - attemptStartTime,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        const err = error as Error;
        console.error(
          `Failed to fetch premium status and email (attempt ${attempt}):`,
          error
        );

        localAnalytics().logEvent("FetchPremiumStatusAttemptFailed", {
          userId: targetUserId,
          attempt,
          maxRetries,
          error: err.message,
          errorName: err.name,
          stack: err.stack,
          attemptDuration: Date.now() - attemptStartTime,
        });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    localAnalytics().logEvent("FetchPremiumStatusExhausted", {
      userId: targetUserId,
      maxRetries,
      totalDuration: Date.now() - startTime,
      finalResult: "not_premium",
    });

    return { isPremium: false, purchaseEmail: null };
  };

  const refreshUserStatus = async () => {
    try {
      if (!userId) {
        setIsUserStatusLoading(false);
        return {
          creditBalance: 0,
          isUserPremium: false,
          nextFreeUnlock: null,
        };
      }

      setIsUserStatusLoading(true);
      const userStatus = await fetchUserStatusFromDB(userId);

      setCreditBalance(userStatus.creditBalance);
      setIsUserPremium(userStatus.isUserPremium);
      setNextChargeDate(userStatus.nextChargeDate);
      setPremiumFinish(userStatus.premiumFinish);
      setSubscriptionTier(userStatus.subscriptionTier);
      setBillingPeriod(userStatus.billingPeriod);
      setIsUserStatusLoading(false);

      return {
        ...userStatus,
        nextFreeUnlock: null,
      };
    } catch (error) {
      logErrorsWithMessage(error, "Failed to get user status");
      const defaultStatus = {
        creditBalance: 0,
        isUserPremium: false,
        nextFreeUnlock: null,
      };
      setCreditBalance(0);
      setIsUserPremium(false);
      setSubscriptionTier(null);
      setBillingPeriod(null);
      setNextFreeUnlock(null);
      setNextChargeDate(null);
      setPremiumFinish(null);
      setIsUserStatusLoading(false);
      return defaultStatus;
    }
  };

  const refreshPurchases = async () => {
    try {
      if (!userId) return;

      const [packagesResult] = await Promise.all([
        getAvailablePackagesInternal(),
      ]);

      if (packagesResult) {
        setAvailablePackages(packagesResult);
        setFormattedOfferings(packagesResult);
      }

      await refreshUserStatus();

      if (Purchases.isConfigured()) {
        try {
          const customerInfo = await Purchases.getSharedInstance().getCustomerInfo();
          if (customerInfo.managementURL) {
            setManagementUrl(customerInfo.managementURL);
          }
        } catch (error) {
          logErrorsWithMessage(error, "Failed to fetch management URL");
        }
      }
    } catch (error) {
      console.error("Failed to refresh purchases:", error);
    }
  };

  const getAvailablePackagesInternal = async (): Promise<PurchasePackage[]> => {
    try {
      if (!Purchases.isConfigured()) {
        return [];
      }

      const offerings = await Purchases.getSharedInstance().getOfferings();
      const packages: PurchasePackage[] = [];

      for (const offeringKey in offerings.all) {
        const offering = offerings.all[offeringKey];
        offering.availablePackages.forEach((pkg: Package) => {
          const product = pkg.webBillingProduct as unknown as {
            identifier: string;
            displayName: string;
            priceString: string;
          };
          packages.push({
            id: product.identifier,
            title: product.displayName,
            shortTitle: product.displayName,
            price: product.priceString,
            bonus: "",
            image: "",
          });
        });
      }

      return packages;
    } catch (error) {
      logErrorsWithMessage(error, "Failed to get available packages");
      return [];
    }
  };

  const purchaseCredits = async (
    productId: string
  ): Promise<PurchaseResult> => {
    if (!userId) {
      return purchaseCreditsGuest(productId);
    }

    setIsPurchasesLoading(true);
    try {
      if (!Purchases.isConfigured()) {
        const initialized = initialize(userId);
        if (!initialized) {
          return {
            success: false,
            error: "Failed to initialize payment system",
          };
        }
      }

      const initialCreditBalance = creditBalance;

      const [pkg, storedPurchaseEmail, sessionEmail] = await Promise.all([
        fetchPackage(productId),
        fetchPurchaseEmail(userId),
        getUserEmail(),
      ]);

      if (!pkg) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const customerEmail = storedPurchaseEmail || sessionEmail;
      const purchaseParams: PurchaseParams = { rcPackage: pkg };
      if (customerEmail) {
        purchaseParams.customerEmail = customerEmail;
      }
      const utmParams = getUtmParams();
      const gclid = getGclid();
      purchaseParams.metadata = {
        ...(referralId && { referral: referralId }),
        ...(gclid && { gclid }),
        ...utmParams,
        $mediaSource: utmParams.utm_source ?? "organic",
        ...(utmParams.utm_campaign && { $campaign: utmParams.utm_campaign }),
        ...(utmParams.utm_content && { $adGroup: utmParams.utm_content }),
        ...(utmParams.utm_term && { $keyword: utmParams.utm_term }),
      };

      const { customerInfo: newCustomerInfo } =
        await Purchases.getSharedInstance().purchase(purchaseParams);

      await waitForUserStatusUpdate(
        userId,
        (status) => status.creditBalance > initialCreditBalance
      );

      localAnalytics().logEvent("PurchaseSuccess", {
        productId,
        userId: userId,
        type: "credits",
        emailPrePopulated: !!customerEmail,
      });

      if (isAnonymous) {
        return {
          success: true,
          customerInfo: newCustomerInfo,
          redirectToSignup: true,
          signupEmail: customerEmail || undefined,
        };
      }

      return {
        success: true,
        customerInfo: newCustomerInfo,
        redirectToDashboard: true,
      };
    } catch (error: unknown) {
      const err = error as { errorCode?: number; message?: string };
      if (err.errorCode === 1) {
        localAnalytics().logEvent("PurchaseCancelled", {
          productId,
          userId: userId,
          type: "credits",
        });
        return {
          success: false,
          error: undefined,
        };
      }

      logErrorsWithMessage(error, "Credit purchase failed");
      localAnalytics().logEvent("PurchaseError", {
        productId,
        userId: userId,
        type: "credits",
        error: err.message || "Unknown error",
      });

      return {
        success: false,
        error: err.message || "Purchase failed",
      };
    } finally {
      setIsPurchasesLoading(false);
    }
  };

  const purchaseSubscription = async (
    productId: string
  ): Promise<PurchaseResult> => {
    if (!userId) {
      return purchaseSubscriptionGuest(productId);
    }

    setIsPurchasesLoading(true);
    const startTime = Date.now();

    localAnalytics().logEvent("CheckoutInitiatedV2", {
      productId,
      userId,
      isAnonymous,
      userAgent: navigator.userAgent,
      timestamp: startTime,
    });

    try {
      if (!Purchases.isConfigured()) {
        const initialized = initialize(userId);
        if (!initialized) {
          return {
            success: false,
            error: "Failed to initialize payment system",
          };
        }
      }

      localAnalytics().logEvent("CheckoutFetchingOfferings", {
        productId,
        userId,
      });

      const [pkg, storedPurchaseEmail, sessionEmail] = await Promise.all([
        fetchPackage(productId),
        fetchPurchaseEmail(userId),
        getUserEmail(),
      ]);

      if (!pkg) {
        localAnalytics().logEvent("CheckoutProductNotFound", {
          productId,
          userId,
        });
        return {
          success: false,
          error: "Subscription product not found",
        };
      }

      const customerEmail = storedPurchaseEmail || sessionEmail;
      const purchaseParams: PurchaseParams = { rcPackage: pkg };
      if (customerEmail) {
        purchaseParams.customerEmail = customerEmail;
      }
      const utmParams = getUtmParams();
      const gclid = getGclid();
      purchaseParams.metadata = {
        ...(referralId && { referral: referralId }),
        ...(gclid && { gclid }),
        ...utmParams,
        $mediaSource: utmParams.utm_source ?? "organic",
        ...(utmParams.utm_campaign && { $campaign: utmParams.utm_campaign }),
        ...(utmParams.utm_content && { $adGroup: utmParams.utm_content }),
        ...(utmParams.utm_term && { $keyword: utmParams.utm_term }),
      };

      localAnalytics().logEvent("CheckoutAttemptingPurchase", {
        productId,
        userId,
        packageIdentifier: pkg.identifier,
        packageTitle: pkg.webBillingProduct.title,
      });

      const { customerInfo: newCustomerInfo } =
        await Purchases.getSharedInstance().purchase(purchaseParams);

      localAnalytics().logEvent("CheckoutPurchaseCompleted", {
        productId,
        userId,
        isAnonymous,
        purchaseDuration: Date.now() - startTime,
      });

      localAnalytics().logEvent("CheckoutFetchingPremiumStatus", {
        productId,
        userId,
      });

      const { isPremium: userIsPremium, purchaseEmail: fetchedPurchaseEmail } =
        await fetchPremiumStatusAndEmail(userId);

      localAnalytics().logEvent("CheckoutPremiumStatusReceived", {
        productId,
        userId,
        isPremium: userIsPremium,
        hasPurchaseEmail: !!fetchedPurchaseEmail,
      });

      if (!userIsPremium) {
        localAnalytics().logEvent("CheckoutPremiumStatusNotConfirmed", {
          productId,
          userId,
          purchaseEmail: fetchedPurchaseEmail,
        });
        throw new Error("Failed to confirm premium status after purchase");
      }

      localAnalytics().logEvent("CheckoutCompletedSuccessfully", {
        productId,
        userId,
        totalDuration: Date.now() - startTime,
        wasAnonymous: isAnonymous,
      });

      localAnalytics().logEvent("PurchaseSuccess", {
        productId,
        userId: userId,
        type: "subscription",
        emailPrePopulated: !!customerEmail,
      });

      await refreshUserStatus();

      if (isAnonymous && fetchedPurchaseEmail) {
        localAnalytics().logEvent("CheckoutAnonymousUserNeedsSignup", {
          productId,
          userId,
          email: fetchedPurchaseEmail,
        });
        return {
          success: true,
          customerInfo: newCustomerInfo,
          redirectToSignup: true,
          signupEmail: fetchedPurchaseEmail,
        };
      }

      return {
        success: true,
        customerInfo: newCustomerInfo,
        redirectToDashboard: true,
      };
    } catch (error: unknown) {
      const err = error as { errorCode?: number; message?: string };
      if (err.errorCode === 1) {
        localAnalytics().logEvent("CheckoutCancelledV2", {
          productId,
          userId,
        });
        localAnalytics().logEvent("PurchaseCancelled", {
          productId,
          userId: userId,
          type: "subscription",
        });
        return {
          success: false,
          error: undefined,
        };
      }

      console.error("Checkout error:", error);

      localAnalytics().logEvent("CheckoutErrorV2", {
        productId,
        errorType: (error as Error)?.name || "UnknownError",
        message: err?.message,
        stack: (error as Error)?.stack,
        isAnonymous,
        userId: userId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        revenueCatConfigured: Purchases.isConfigured(),
      });

      logErrorsWithMessage(error, "Subscription purchase failed");
      localAnalytics().logEvent("PurchaseError", {
        productId,
        userId: userId,
        type: "subscription",
        error: err.message || "Unknown error",
      });

      return {
        success: false,
        error: err.message || "Purchase failed",
      };
    } finally {
      setIsPurchasesLoading(false);
    }
  };

  const purchaseCreditsGuest = async (
    productId: string
  ): Promise<PurchaseResult> => {
    if (isAuthenticated) {
      return purchaseCredits(productId);
    }

    setIsPurchasesLoading(true);
    try {
      const {
        data: { user: anonymousUser },
        error: authError,
      } = await supabase.auth.signInAnonymously();

      if (authError || !anonymousUser) {
        throw new Error("Failed to create anonymous session");
      }
      const effectiveUserId = anonymousUser.id;
      const initialized = initialize(effectiveUserId);
      if (!initialized) {
        return {
          success: false,
          error: "Failed to initialize payment system",
        };
      }

      const [initialUserStatus, pkg] = await Promise.all([
        fetchUserStatusFromDB(effectiveUserId),
        fetchPackage(productId),
      ]);

      if (!pkg) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const purchaseParams: PurchaseParams = { rcPackage: pkg };
      const utmParams = getUtmParams();
      const gclid = getGclid();
      purchaseParams.metadata = {
        ...(referralId && { referral: referralId }),
        ...(gclid && { gclid }),
        ...utmParams,
        $mediaSource: utmParams.utm_source ?? "organic",
        ...(utmParams.utm_campaign && { $campaign: utmParams.utm_campaign }),
        ...(utmParams.utm_content && { $adGroup: utmParams.utm_content }),
        ...(utmParams.utm_term && { $keyword: utmParams.utm_term }),
      };

      const { customerInfo: newCustomerInfo } =
        await Purchases.getSharedInstance().purchase(purchaseParams);

      await waitForUserStatusUpdate(
        effectiveUserId,
        (status) => status.creditBalance > initialUserStatus.creditBalance
      );

      localAnalytics().logEvent("PurchaseSuccess", {
        productId,
        type: "credits",
        isGuest: true,
        userId: effectiveUserId,
      });

      const purchaseEmailFromDb = await fetchPurchaseEmail(effectiveUserId);
      if (purchaseEmailFromDb) {
        setPurchaseEmail(purchaseEmailFromDb);
      }

      return {
        success: true,
        customerInfo: newCustomerInfo,
        redirectToSignup: true,
        signupEmail: purchaseEmailFromDb || undefined,
      };
    } catch (error: unknown) {
      const err = error as { errorCode?: number; message?: string };
      if (err.errorCode === 1) {
        localAnalytics().logEvent("PurchaseCancelled", {
          productId,
          type: "credits",
          isGuest: true,
        });
        return {
          success: false,
          error: undefined,
        };
      }

      logErrorsWithMessage(error, "Guest credit purchase failed");
      localAnalytics().logEvent("PurchaseError", {
        productId,
        type: "credits",
        isGuest: true,
        error: err.message || "Unknown error",
      });

      return {
        success: false,
        error: err.message || "Purchase failed",
      };
    } finally {
      setIsPurchasesLoading(false);
    }
  };

  const openManagementPortal = () => {
    if (managementUrl) {
      localAnalytics().logEvent("ManagementPortalOpened", {
        userId,
        subscriptionTier,
        billingPeriod,
      });
      window.open(managementUrl, "_blank");
    }
  };

  const purchaseSubscriptionGuest = async (
    productId: string
  ): Promise<PurchaseResult> => {
    if (isAuthenticated) {
      return purchaseSubscription(productId);
    }

    setIsPurchasesLoading(true);
    const startTime = Date.now();

    localAnalytics().logEvent("CheckoutInitiatedV2", {
      productId,
      isAnonymous: true,
      userAgent: navigator.userAgent,
      timestamp: startTime,
    });

    try {
      localAnalytics().logEvent("CheckoutAnonymousSignInRequired", {
        productId,
      });

      const effectiveUserId = await signInAnonymously();
      if (!effectiveUserId) {
        localAnalytics().logEvent("CheckoutAnonymousSignInFailed", {
          productId,
        });
        throw new Error("Failed to create anonymous session");
      }

      localAnalytics().logEvent("CheckoutAnonymousSignInSuccess", {
        productId,
        newUserId: effectiveUserId,
      });

      const initialized = initialize(effectiveUserId);
      if (!initialized) {
        return {
          success: false,
          error: "Failed to initialize payment system",
        };
      }

      localAnalytics().logEvent("CheckoutFetchingOfferings", {
        productId,
        userId: effectiveUserId,
      });

      const pkg = await fetchPackage(productId);
      if (!pkg) {
        localAnalytics().logEvent("CheckoutProductNotFound", {
          productId,
          userId: effectiveUserId,
        });
        return {
          success: false,
          error: "Subscription product not found",
        };
      }

      const purchaseParams: PurchaseParams = { rcPackage: pkg };
      const utmParams = getUtmParams();
      const gclid = getGclid();
      purchaseParams.metadata = {
        ...(referralId && { referral: referralId }),
        ...(gclid && { gclid }),
        ...utmParams,
        $mediaSource: utmParams.utm_source ?? "organic",
        ...(utmParams.utm_campaign && { $campaign: utmParams.utm_campaign }),
        ...(utmParams.utm_content && { $adGroup: utmParams.utm_content }),
        ...(utmParams.utm_term && { $keyword: utmParams.utm_term }),
      };

      localAnalytics().logEvent("CheckoutAttemptingPurchase", {
        productId,
        userId: effectiveUserId,
        packageIdentifier: pkg.identifier,
        packageTitle: pkg.webBillingProduct.title,
      });

      const { customerInfo: newCustomerInfo } =
        await Purchases.getSharedInstance().purchase(purchaseParams);

      localAnalytics().logEvent("CheckoutPurchaseCompleted", {
        productId,
        userId: effectiveUserId,
        isAnonymous: true,
        purchaseDuration: Date.now() - startTime,
      });

      localAnalytics().logEvent("CheckoutFetchingPremiumStatus", {
        productId,
        userId: effectiveUserId,
      });

      const { isPremium: userIsPremium, purchaseEmail: fetchedPurchaseEmail } =
        await fetchPremiumStatusAndEmail(effectiveUserId);

      localAnalytics().logEvent("CheckoutPremiumStatusReceived", {
        productId,
        userId: effectiveUserId,
        isPremium: userIsPremium,
        hasPurchaseEmail: !!fetchedPurchaseEmail,
      });

      if (!userIsPremium) {
        localAnalytics().logEvent("CheckoutPremiumStatusNotConfirmed", {
          productId,
          userId: effectiveUserId,
          purchaseEmail: fetchedPurchaseEmail,
        });
        throw new Error("Failed to confirm premium status after purchase");
      }

      if (effectiveUserId) {
        void retrieveAndSetPurchaseEmail(effectiveUserId);
      }

      localAnalytics().logEvent("CheckoutCompletedSuccessfully", {
        productId,
        userId: effectiveUserId,
        totalDuration: Date.now() - startTime,
        wasAnonymous: true,
      });

      localAnalytics().logEvent("PurchaseSuccess", {
        productId,
        type: "subscription",
        isGuest: true,
        userId: effectiveUserId,
      });

      if (fetchedPurchaseEmail) {
        localAnalytics().logEvent("CheckoutGuestUserNeedsSignup", {
          productId,
          userId: effectiveUserId,
          email: fetchedPurchaseEmail,
        });
        return {
          success: true,
          customerInfo: newCustomerInfo,
          redirectToSignup: true,
          signupEmail: fetchedPurchaseEmail,
        };
      }

      return {
        success: true,
        customerInfo: newCustomerInfo,
        redirectToDashboard: true,
      };
    } catch (error: unknown) {
      const err = error as { errorCode?: number; message?: string };
      if (err.errorCode === 1) {
        localAnalytics().logEvent("CheckoutCancelledV2", {
          productId,
          isGuest: true,
        });
        localAnalytics().logEvent("PurchaseCancelled", {
          productId,
          type: "subscription",
          isGuest: true,
        });
        return {
          success: false,
          error: undefined,
        };
      }

      console.error("Checkout error:", error);

      localAnalytics().logEvent("CheckoutErrorV2", {
        productId,
        errorType: (error as Error)?.name || "UnknownError",
        message: err?.message,
        stack: (error as Error)?.stack,
        isAnonymous: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        revenueCatConfigured: Purchases.isConfigured(),
      });

      logErrorsWithMessage(error, "Guest subscription purchase failed");
      localAnalytics().logEvent("PurchaseError", {
        productId,
        type: "subscription",
        isGuest: true,
        error: err.message || "Unknown error",
      });

      return {
        success: false,
        error: err.message || "Purchase failed",
      };
    } finally {
      setIsPurchasesLoading(false);
    }
  };

  return (
    <PurchasesContext.Provider
      value={{
        isInitialized,
        isPurchasesLoading,
        isUserStatusLoading,
        availablePackages,
        formattedOfferings,
        creditBalance,
        isUserPremium,
        subscriptionTier,
        billingPeriod,
        nextFreeUnlock,
        nextChargeDate,
        premiumFinish,
        purchaseEmail,
        managementUrl,
        purchaseCredits,
        purchaseSubscription,
        purchaseCreditsGuest,
        purchaseSubscriptionGuest,
        refreshUserStatus,
        refreshPurchases,
        fetchPremiumStatusAndEmail,
        openManagementPortal,
      }}
    >
      {children}
    </PurchasesContext.Provider>
  );
};
