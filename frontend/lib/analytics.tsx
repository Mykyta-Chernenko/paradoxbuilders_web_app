"use client";

import { IS_DEV } from "@/lib/constants";
import posthog from "posthog-js";

if (typeof window !== "undefined" && !IS_DEV) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false,
    disable_session_recording: false,
    session_recording: {
      recordCrossOriginIframes: true,
      maskAllInputs: false
    },
  });
}

export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  if (IS_DEV) {
    console.log(`[Analytics Dev] ${eventName}`, properties);
    return;
  }

  if (typeof window !== "undefined") {
    const props = { ...properties };
    if (!props.userId) {
      props.userId = "unauthenticated";
    }

    if (posthog) {
      posthog.capture(eventName, props);
    }
  }
}

export const localAnalytics = () => ({
  logEvent: (eventName: string, properties?: Record<string, unknown>) => {
    trackEvent(eventName, properties);
  },

  identify: (userId: string) => {
    if (IS_DEV) {
      console.log(`[Analytics Dev] Identify user: ${userId}`);
      return;
    }

    if (typeof window !== "undefined" && posthog) {
      posthog.identify(userId);
    }
  },

  reset: () => {
    if (IS_DEV) {
      console.log("[Analytics Dev] Reset user");
      return;
    }

    if (typeof window !== "undefined" && posthog) {
      posthog.reset();
    }
  },
});

export const PostHogClient = posthog;
