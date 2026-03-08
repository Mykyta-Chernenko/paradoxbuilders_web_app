import * as Sentry from "@sentry/nextjs";
import toast from "react-hot-toast";
import { localAnalytics } from "./analytics";

export const logErrorsWithMessage = (error: unknown, message: string) => {
  logErrorsWithoutAlert(error, message);

  const errorMessage = error instanceof Error ? error.message : message;
  toast.error(`Error: ${errorMessage}`);
};

const NETWORK_ERROR_PATTERNS = [
  "Failed to fetch",
  "Failed to send a request to the Edge Function",
  "Load failed",
  "NetworkError",
  "network connection",
  "Error performing request",
];

const isNetworkError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  if ("name" in error) {
    const name = (error as { name: string }).name;
    if (name === "FunctionsFetchError" || name === "NetworkError") return true;
  }
  const obj = error as Record<string, unknown>;
  const texts = [obj.message, obj.details].filter((v) => typeof v === "string") as string[];
  return texts.some((t) => NETWORK_ERROR_PATTERNS.some((p) => t.includes(p)));
};

const isBusinessLogicError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const obj = error as Record<string, unknown>;
  if (obj.code === "INSUFFICIENT_CREDITS" || obj.error === "insufficient_credits") return true;
  if (error instanceof Error && error.message.includes("insufficient_credits")) return true;
  return false;
};

export const logErrorsWithoutAlert = (error: unknown, message: string) => {
  console.error(`[Error] ${message}`, error);

  if (isNetworkError(error) || isBusinessLogicError(error)) {
    return;
  }

  const isFunctionsHttpError = error instanceof Error && error.name === "FunctionsHttpError";
  if (isFunctionsHttpError) {
    return;
  }

  let sentryError: Error;
  let extraContext: Record<string, unknown> = { message };

  if (error instanceof Error) {
    sentryError = error;
    extraContext.errorDetails = error;
  } else if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const errorMsg = obj.message || obj.error || obj.code || "Unknown error";
    sentryError = new Error(`${message}: ${errorMsg}`);
    extraContext = { ...extraContext, ...obj };
  } else {
    sentryError = new Error(`${message}: ${String(error)}`);
  }

  Sentry.captureException(sentryError, {
    tags: {
      errorMessage: message,
    },
    extra: extraContext,
  });

  const errorObj = error as Error;
  localAnalytics().logEvent("ErrorTracking", {
    errorType: errorObj?.name || "UnknownError",
    message: errorObj?.message || message,
    stack: errorObj?.stack,
  });
};
