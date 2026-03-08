"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const SHOW_INTERVIEW_REQUEST_KEY = "SHOW_INTERVIEW_REQUEST";
const SHOW_INTERVIEW_COUNT_KEY = "SHOW_INTERVIEW_COUNT";
const MAX_SHOW_COUNT = 5;

interface InterviewBannerContextType {
  shouldShowBanner: boolean;
  showCount: number;
  triggerBanner: () => void;
  closeBanner: () => void;
  incrementShowCount: () => void;
  requestBannerOnPage: (page: string) => void;
  isInterviewModalOpen: boolean;
  openInterviewModal: () => void;
  closeInterviewModal: () => void;
  markInterviewCompleted: () => void;
  interviewCompleted: boolean;
}

const InterviewBannerContext = createContext<InterviewBannerContextType | undefined>(undefined);

export function InterviewBannerProvider({ children }: { children: ReactNode }) {
  const { userId, isAnonymous } = useAuth();
  const { flags } = useFeatureFlags();

  const [showRequest, setShowRequest] = useState<boolean>(false);
  const [showCount, setShowCount] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [triggeredPages, setTriggeredPages] = useState<Set<string>>(new Set());
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRequest = localStorage.getItem(SHOW_INTERVIEW_REQUEST_KEY);
    const storedCount = localStorage.getItem(SHOW_INTERVIEW_COUNT_KEY);

    setShowRequest(storedRequest === "true");
    setShowCount(storedCount ? parseInt(storedCount, 10) : 0);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!userId || isAnonymous) return;

    const checkInterviewStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("interview_text_user")
          .select("status")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) return;

        if (data?.status === "completed") {
          setInterviewCompleted(true);
        }
      } catch {
        // ignore
      }
    };

    checkInterviewStatus();
  }, [userId, isAnonymous]);

  const shouldShowBanner =
    isInitialized &&
    showRequest &&
    showCount < MAX_SHOW_COUNT &&
    !interviewCompleted &&
    !!userId &&
    !isAnonymous &&
    flags.show_interview_general;

  const closeBanner = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SHOW_INTERVIEW_REQUEST_KEY, "false");
    setShowRequest(false);
  }, []);

  const incrementShowCount = useCallback(() => {
    if (typeof window === "undefined") return;
    setShowCount((prev) => {
      const newCount = prev + 1;
      localStorage.setItem(SHOW_INTERVIEW_COUNT_KEY, String(newCount));
      return newCount;
    });
  }, []);

  const triggerBanner = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SHOW_INTERVIEW_REQUEST_KEY, "true");
    setShowRequest(true);
    incrementShowCount();
  }, [incrementShowCount]);

  const requestBannerOnPage = useCallback((page: string) => {
    if (triggeredPages.has(page)) return;
    setTriggeredPages(prev => new Set(prev).add(page));
    if (!showRequest && showCount < MAX_SHOW_COUNT) {
      localStorage.setItem(SHOW_INTERVIEW_REQUEST_KEY, "true");
      setShowRequest(true);
      incrementShowCount();
    }
  }, [triggeredPages, showRequest, showCount, incrementShowCount]);

  const openInterviewModal = useCallback(() => {
    setIsInterviewModalOpen(true);
  }, []);

  const closeInterviewModal = useCallback(() => {
    setIsInterviewModalOpen(false);
  }, []);

  const markInterviewCompleted = useCallback(() => {
    setInterviewCompleted(true);
    setShowRequest(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(SHOW_INTERVIEW_REQUEST_KEY, "false");
    }
  }, []);

  return (
    <InterviewBannerContext.Provider
      value={{
        shouldShowBanner,
        showCount,
        triggerBanner,
        closeBanner,
        incrementShowCount,
        requestBannerOnPage,
        isInterviewModalOpen,
        openInterviewModal,
        closeInterviewModal,
        markInterviewCompleted,
        interviewCompleted,
      }}
    >
      {children}
    </InterviewBannerContext.Provider>
  );
}

export function useInterviewBanner() {
  const context = useContext(InterviewBannerContext);
  if (context === undefined) {
    throw new Error("useInterviewBanner must be used within an InterviewBannerProvider");
  }
  return context;
}
