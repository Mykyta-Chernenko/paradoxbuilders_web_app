import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isProduction,
  integrations: isProduction ? [Sentry.replayIntegration()] : [],
  tracesSampleRate: isProduction ? 0.1 : 0,
  replaysSessionSampleRate: isProduction ? 1.0 : 0,
  replaysOnErrorSampleRate: isProduction ? 1.0 : 0,
  sendDefaultPii: true,
});

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (
      event.reason instanceof TypeError &&
      event.reason.message === "Load failed"
    ) {
      window.location.reload();
    }
  });

  window.addEventListener("error", (event) => {
    if (
      event.error instanceof TypeError &&
      event.error.message === "Load failed"
    ) {
      window.location.reload();
    }
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
