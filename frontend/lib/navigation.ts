"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { localAnalytics } from "@/lib/analytics";

export function useStartFreeNavigation() {
  const router = useRouter();

  const handleStartFree = useCallback(() => {
    localAnalytics().logEvent("StartFreeClicked", {});
    router.push("/auth/signup");
  }, [router]);

  return { handleStartFree };
}
