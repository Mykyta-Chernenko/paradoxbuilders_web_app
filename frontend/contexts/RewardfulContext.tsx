"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

declare global {
  interface Window {
    Rewardful?: {
      referral: string;
    };
    rewardful?: (action: string, callback: () => void) => void;
  }
}

interface RewardfulContextType {
  referralId: string | null;
}

const RewardfulContext = createContext<RewardfulContextType | undefined>(
  undefined
);

export const useRewardful = () => {
  const context = useContext(RewardfulContext);
  if (!context) {
    throw new Error("useRewardful must be used within a RewardfulProvider");
  }
  return context;
};

const REFERRAL_STORAGE_KEY = "rewardful_referral";

const getInitialReferral = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
};

export const RewardfulProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [referralId, setReferralId] = useState<string | null>(getInitialReferral);
  const { userId } = useAuth();

  const saveReferralToDb = useCallback(async (referral: string, targetUserId: string) => {
    await supabase
      .from("user_technical_details")
      .update({ rewardful_referral: referral })
      .eq("user_id", targetUserId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.rewardful) return;

    window.rewardful("ready", () => {
      if (window.Rewardful?.referral) {
        const newReferralId = window.Rewardful.referral;
        setReferralId(newReferralId);
        localStorage.setItem(REFERRAL_STORAGE_KEY, newReferralId);
      }
    });
  }, []);

  useEffect(() => {
    if (userId && referralId) {
      saveReferralToDb(referralId, userId);
    }
  }, [userId, referralId, saveReferralToDb]);

  return (
    <RewardfulContext.Provider value={{ referralId }}>
      {children}
    </RewardfulContext.Provider>
  );
};
