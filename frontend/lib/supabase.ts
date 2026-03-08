import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];

const fetchWithRetry: typeof fetch = async (input, init) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      const isNetworkError = error instanceof TypeError || (error instanceof DOMException && error.name === "NetworkError");
      if (isNetworkError && attempt < RETRY_DELAYS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
};

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithRetry,
  },
});

const originalInvoke = client.functions.invoke.bind(client.functions);
client.functions.invoke = async (functionName: string, options?: Record<string, unknown>) => {
  const result = await originalInvoke(functionName, options);
  if (result.error) {
    const status = (result.error as { context?: { status?: number } })?.context?.status;
    if (status && status !== 402) {
      let responseBody = "";
      try {
        responseBody = JSON.stringify(result.data);
      } catch {
        /* ignore */
      }
      Sentry.captureException(
        new Error(`Edge Function ${functionName}: HTTP ${status}`),
        {
          tags: {
            functionName,
            statusCode: String(status),
            errorType: "edge_function",
          },
          extra: {
            functionName,
            status,
            responseBody,
            responseData: result.data,
          },
        }
      );
    }
  }
  return result;
};

export const supabase = client;
