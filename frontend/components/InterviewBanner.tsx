"use client";

import { useEffect } from "react";
import { X, ChatText, Gift, Clock, Sparkle } from "@phosphor-icons/react";
import { useInterviewBanner } from "@/contexts/InterviewBannerContext";

export function InterviewBanner() {
  const {
    shouldShowBanner,
    closeBanner,
    incrementShowCount,
    isInterviewModalOpen,
    openInterviewModal,
    closeInterviewModal,
    markInterviewCompleted,
  } = useInterviewBanner();

  useEffect(() => {
    if (shouldShowBanner) {
      incrementShowCount();
    }
  }, [shouldShowBanner, incrementShowCount]);

  const handleStartClick = () => {
    openInterviewModal();
  };

  const handleClose = () => {
    closeBanner();
  };

  return (
    <>
      {shouldShowBanner && (
        <div className="hidden md:block fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-right-5 fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 rounded-full p-1.5">
                    <Gift className="w-5 h-5 text-white" weight="fill" />
                  </div>
                  <span className="text-base font-bold text-white">
                    Earn Rewards
                  </span>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/70 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5">
              <h3 className="text-xl font-bold text-slate-800 mb-1">
                Quick Interview
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                Help us improve your experience
              </p>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Share your feedback in a short interview and earn credits as a
                thank you.
              </p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkle
                    className="w-5 h-5 text-emerald-600"
                    weight="fill"
                  />
                  <span className="text-sm font-semibold text-emerald-800">
                    Earn bonus credits
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Clock className="w-4 h-4" />
                <span>Takes about 5 minutes</span>
              </div>

              <button
                onClick={handleStartClick}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-teal-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-200"
              >
                <ChatText className="w-5 h-5" weight="bold" />
                Start Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
