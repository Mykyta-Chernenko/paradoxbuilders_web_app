function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value as unknown as Record<string, unknown>),
    };
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(serializeValue);
    }
    const serialized: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      serialized[key] = serializeValue((value as Record<string, unknown>)[key]);
    }
    return serialized;
  }
  return value;
}

export function log(message: string, data?: unknown) {
  const serialized = data !== undefined ? serializeValue(data) : undefined;
  console.log(
    `[${new Date().toISOString()}] ${message}`,
    serialized ? JSON.stringify(serialized, null, 2) : ""
  );
}

export function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
) {
  const errorInfo = serializeValue(error);
  const logData = extra ? { error: errorInfo, ...extra } : { error: errorInfo };
  log(`Error in ${context}:`, logData);
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Unknown error occurred";
}

export async function notifyTelegram(message: string): Promise<boolean> {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!BOT_TOKEN || !CHAT_ID) {
    console.log(
      "[Telegram] Missing BOT_TOKEN or CHAT_ID, skipping notification"
    );
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "HTML",
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.log("[Telegram] Failed to send notification:", err);
    return false;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function logInsufficientCredits(
  functionName: string,
  userId: string,
  currentCredits: number,
  requiredCredits: number,
  extra?: Record<string, unknown>
) {
  log(`[402] Insufficient credits in ${functionName}`, {
    userId,
    currentCredits,
    requiredCredits,
    shortfall: requiredCredits - currentCredits,
    ...extra,
  });
}

export async function alertError(
  functionName: string,
  error: unknown,
  extra?: Record<string, unknown>
): Promise<void> {
  console.log(
    `[${new Date().toISOString()}] ${functionName}: alert Error`,
    error
  );
  const timestamp = new Date().toISOString();
  const errorMessage = escapeHtml(formatErrorMessage(error));
  const errorStack =
    error instanceof Error
      ? escapeHtml(error.stack?.split("\n").slice(0, 3).join("\n") || "")
      : "";

  let message = `🚨 <b>Function Error</b>\n\n`;
  message += `<b>Function:</b> ${escapeHtml(functionName)}\n`;
  message += `<b>Time:</b> ${timestamp}\n`;
  message += `<b>Error:</b> ${errorMessage}\n`;

  if (errorStack) {
    message += `<b>Stack:</b>\n<pre>${errorStack}</pre>\n`;
  }

  if (extra && Object.keys(extra).length > 0) {
    message += `\n<b>Context:</b>\n`;
    for (const [key, value] of Object.entries(extra)) {
      const displayValue =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      message += `• ${escapeHtml(key)}: ${escapeHtml(
        displayValue.substring(0, 100)
      )}\n`;
    }
  }

  await notifyTelegram(message);
}
