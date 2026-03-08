import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isProduction,
  tracesSampleRate: 0,
  debug: false,
  environment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT || "development",
});
