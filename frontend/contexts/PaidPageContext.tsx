"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { localAnalytics } from "@/lib/analytics";

interface PaidPageData {
  currentCredits: number;
  requiredCredits: number;
}

interface PaidPageContextType {
  showPaidPage: (currentCredits: number, requiredCredits: number) => void;
  hidePaidPage: () => void;
  isVisible: boolean;
}

const PaidPageContext = createContext<PaidPageContextType | undefined>(undefined);

export function PaidPageProvider({ children }: { children: ReactNode }) {
  const [creditsData, setCreditsData] = useState<PaidPageData | null>(null);

  const showPaidPage = useCallback((currentCredits: number, requiredCredits: number) => {
    setCreditsData({ currentCredits, requiredCredits });
    localAnalytics().logEvent("paid_page_shown", {
      currentCredits,
      requiredCredits,
      shortfall: requiredCredits - currentCredits,
    });
  }, []);

  const hidePaidPage = useCallback(() => {
    setCreditsData(null);
  }, []);

  return (
    <PaidPageContext.Provider
      value={{
        showPaidPage,
        hidePaidPage,
        isVisible: creditsData !== null,
      }}
    >
      {children}
    </PaidPageContext.Provider>
  );
}

export function usePaidPage() {
  const context = useContext(PaidPageContext);
  if (context === undefined) {
    throw new Error("usePaidPage must be used within a PaidPageProvider");
  }
  return context;
}
