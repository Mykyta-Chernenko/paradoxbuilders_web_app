import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isProduction,
  tracesSampleRate: 0,
  debug: false,
  ignoreErrors: [
    "Failed to read a named property 'removeEventListener' from 'Window'",
    "Failed to execute 'removeChild' on 'Node'",
    "Failed to execute 'insertBefore' on 'Node'",
    "BodyStreamBuffer was aborted",
    "Cannot assign to read only property 'pushState'",
    "Error performing request. Please check your network connection and try again.",
    "Failed to fetch",
    "Failed to send a request to the Edge Function",
    "Load failed",
    "NetworkError",
    "network connection",
    "FunctionsFetchError",
    "Object Not Found Matching Id:",
  ],
  beforeSend(event) {
    const ua = navigator?.userAgent || "";
    const botPattern =
      /Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Bytespider|GPTBot|ClaudeBot|AdsBot|Mediapartners-Google|APIs-Google/i;
    if (botPattern.test(ua)) {
      return null;
    }

    const type = event.exception?.values?.[0]?.type || "";
    if (type === "FunctionsFetchError" || type === "NotFoundError") {
      return null;
    }
    const frames =
      event.exception?.values?.[0]?.stacktrace?.frames || [];
    const isExtension = frames.some(
      (f) =>
        f.filename?.includes("inpage.js") ||
        f.filename?.startsWith("chrome-extension://") ||
        f.filename?.startsWith("moz-extension://") ||
        f.filename?.startsWith("safari-extension://")
    );
    if (isExtension) {
      return null;
    }
    return event;
  },
  beforeSendTransaction() {
    return null;
  },
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  environment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT || "development",
});
