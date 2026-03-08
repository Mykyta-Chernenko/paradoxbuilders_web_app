import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log, alertError } from "../_shared/utils.ts";

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  product_id: string;
  purchased_at_ms: number;
  expiration_at_ms: number;
  new_product_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
  price?: number;
  currency?: string;
  price_in_purchased_currency?: number;
  purchased_currency?: string;
  environment?: string;
  subscriber_attributes?: {
    $email?: {
      value: string;
      updated_at_ms: number;
    };
  };
}

// TODO: Configure your subscription products
const SUBSCRIPTION_CONFIG = {
  monthly_basic: { monthlyCredits: 1000, tier: "basic", isYearly: false },
  monthly_pro: { monthlyCredits: 5000, tier: "pro", isYearly: false },
  yearly_basic: { monthlyCredits: 1000, tier: "basic", isYearly: true },
  yearly_pro: { monthlyCredits: 5000, tier: "pro", isYearly: true },
} as const;

function getSubscriptionConfig(productId: string): {
  monthlyCredits: number;
  isYearly: boolean;
  isOneTime: boolean;
  tier: string;
} | null {
  const lowerProductId = productId.toLowerCase();
  const key = Object.keys(SUBSCRIPTION_CONFIG).find((k) =>
    lowerProductId.includes(k.toLowerCase())
  ) as keyof typeof SUBSCRIPTION_CONFIG | undefined;

  if (!key) return null;

  const config = SUBSCRIPTION_CONFIG[key];
  return {
    monthlyCredits: config.monthlyCredits,
    isYearly: config.isYearly,
    isOneTime: false,
    tier: config.tier,
  };
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

interface ScheduledCreditEntry {
  user_id: string;
  credit_amount: number;
  distribute_on: Date;
  done: boolean;
  product_id: string;
}

async function createScheduledCredits(
  supabaseAdminClient: SupabaseClient,
  userId: string,
  monthlyCredits: number,
  isYearly: boolean,
  productId: string
): Promise<void> {
  const now = new Date();
  const entries: ScheduledCreditEntry[] = [];

  entries.push({
    user_id: userId,
    credit_amount: monthlyCredits,
    distribute_on: now,
    done: true,
    product_id: productId,
  });

  if (isYearly) {
    for (let i = 1; i < 12; i++) {
      entries.push({
        user_id: userId,
        credit_amount: monthlyCredits,
        distribute_on: addMonths(now, i),
        done: false,
        product_id: productId,
      });
    }
  }

  const { error } = await supabaseAdminClient
    .from("scheduled_credits")
    .insert(entries);

  if (error) {
    log("Error creating scheduled credits:", error);
    throw error;
  }

  log("Created scheduled credits:", {
    userId,
    totalEntries: entries.length,
    isYearly,
    monthlyCredits,
  });
}

async function handleSubscriptionPurchase(
  supabaseAdminClient: SupabaseClient,
  appUserId: string,
  event: RevenueCatEvent,
  isRenewal: boolean = false
): Promise<void> {
  if (event.subscriber_attributes?.$email?.value) {
    try {
      await updatePurchaseEmail(
        supabaseAdminClient,
        appUserId,
        event.subscriber_attributes.$email.value
      );
    } catch (error) {
      log("Error updating purchase email (non-fatal):", error);
    }
  }

  const config = getSubscriptionConfig(event.product_id);
  if (!config) {
    log("Unknown product, skipping:", event.product_id);
    return;
  }

  const { monthlyCredits, isYearly, isOneTime, tier } = config;
  const purchasedAt = new Date(event.purchased_at_ms);
  const expirationAt = new Date(event.expiration_at_ms);
  const now = new Date();

  const { data: currentData, error: fetchError } = await supabaseAdminClient
    .from("user_premium")
    .select("credits, subscription_tier")
    .eq("user_id", appUserId)
    .single();

  if (fetchError) {
    log("Error fetching current credits:", fetchError);
    throw fetchError;
  }

  const currentCredits = currentData?.credits || 0;
  const oldTier = currentData?.subscription_tier;

  let creditsToAdd = monthlyCredits;
  let isPlanChange = false;

  if (isRenewal && oldTier && oldTier !== tier) {
    isPlanChange = true;
    let oldMonthlyCredits = 0;
    const oldKey = Object.keys(SUBSCRIPTION_CONFIG).find((k) => {
      const c = SUBSCRIPTION_CONFIG[k as keyof typeof SUBSCRIPTION_CONFIG];
      return c.tier === oldTier;
    }) as keyof typeof SUBSCRIPTION_CONFIG | undefined;
    if (oldKey) {
      oldMonthlyCredits = SUBSCRIPTION_CONFIG[oldKey].monthlyCredits;
    }
    creditsToAdd = monthlyCredits - oldMonthlyCredits;

    const { error: deleteError } = await supabaseAdminClient
      .from("scheduled_credits")
      .delete()
      .eq("user_id", appUserId)
      .eq("done", false);

    if (deleteError) {
      log("Error deleting old scheduled credits for plan change:", deleteError);
    }
  }

  const newCredits = Math.max(0, currentCredits + creditsToAdd);

  const updateData: Record<string, unknown> = {
    credits: newCredits,
    has_purchased: true,
    updated_at: now,
  };

  if (!isOneTime) {
    updateData.next_charge_date = addMonths(now, 1);
    updateData.premium_start = purchasedAt;
    updateData.premium_finish = expirationAt;
    updateData.subscription_tier = tier;
    updateData.billing_period = isYearly ? "yearly" : "monthly";
  }

  const { error } = await supabaseAdminClient
    .from("user_premium")
    .update(updateData)
    .eq("user_id", appUserId);

  if (error) {
    log("Error updating user_premium for subscription purchase:", error);
    throw error;
  }

  await createScheduledCredits(
    supabaseAdminClient,
    appUserId,
    monthlyCredits,
    isYearly,
    event.product_id
  );

  log("Updated subscription purchase for user:", {
    appUserId,
    productId: event.product_id,
    creditsAdded: creditsToAdd,
    newTotal: newCredits,
    isRenewal,
    isPlanChange,
    isYearly,
    isOneTime,
  });
}

async function handleSubscriptionEnd(
  supabaseAdminClient: SupabaseClient,
  appUserId: string
): Promise<void> {
  const now = new Date();
  const updateData = {
    premium_finish: now,
    updated_at: now,
    subscription_tier: null,
    billing_period: null,
  };

  const { error } = await supabaseAdminClient
    .from("user_premium")
    .update(updateData)
    .eq("user_id", appUserId);

  if (error) {
    log("Error updating user_premium for subscription end:", error);
    throw error;
  }
  log("Ended subscription for user:", appUserId);
}

async function handleSubscriptionRefund(
  supabaseAdminClient: SupabaseClient,
  appUserId: string,
  event: RevenueCatEvent
): Promise<void> {
  const now = new Date();
  const config = getSubscriptionConfig(event.product_id);
  const creditsToRemove = config?.monthlyCredits || 0;

  const { data: currentData, error: fetchError } = await supabaseAdminClient
    .from("user_premium")
    .select("credits")
    .eq("user_id", appUserId)
    .single();

  if (fetchError) {
    log("Error fetching current credits for refund:", fetchError);
    throw fetchError;
  }

  const currentCredits = currentData?.credits || 0;
  const newCredits = Math.max(0, currentCredits - creditsToRemove);

  const updateData = {
    premium_finish: now,
    credits: newCredits,
    updated_at: now,
    next_charge_date: null,
    subscription_tier: null,
    billing_period: null,
  };

  const { error } = await supabaseAdminClient
    .from("user_premium")
    .update(updateData)
    .eq("user_id", appUserId);

  if (error) {
    log("Error updating user_premium for subscription refund:", error);
    throw error;
  }

  const { error: deleteError } = await supabaseAdminClient
    .from("scheduled_credits")
    .delete()
    .eq("user_id", appUserId)
    .eq("done", false);

  if (deleteError) {
    log("Error deleting pending scheduled credits for refund:", deleteError);
  }

  log("Processed refund for user:", {
    appUserId,
    productId: event.product_id,
    creditsRemoved: creditsToRemove,
    newTotal: newCredits,
  });
}

async function handleSubscriptionTransfer(
  supabaseAdminClient: SupabaseClient,
  fromUserId: string,
  toUserId: string,
  event: RevenueCatEvent
): Promise<void> {
  const { data: oldUserData, error: fetchError } = await supabaseAdminClient
    .from("user_premium")
    .select("premium_finish, credits, next_charge_date, subscription_tier, billing_period")
    .eq("user_id", fromUserId)
    .single();

  if (fetchError) {
    log("Error fetching old user premium data for transfer:", fetchError);
    throw fetchError;
  }

  const now = new Date();
  const oldPremiumFinish =
    oldUserData?.premium_finish || new Date(event.expiration_at_ms);
  const oldCredits = oldUserData?.credits || 0;
  const oldNextChargeDate = oldUserData?.next_charge_date;
  const oldSubscriptionTier = oldUserData?.subscription_tier;
  const oldBillingPeriod = oldUserData?.billing_period;

  const { error: updateFromError } = await supabaseAdminClient
    .from("user_premium")
    .update({
      premium_finish: now,
      credits: 100,
      has_purchased: false,
      updated_at: now,
      next_charge_date: null,
      subscription_tier: null,
      billing_period: null,
    })
    .eq("user_id", fromUserId);

  if (updateFromError) {
    log("Error updating old user premium data for transfer:", updateFromError);
    throw updateFromError;
  }

  const { data: newUserData, error: newUserFetchError } =
    await supabaseAdminClient
      .from("user_premium")
      .select("credits")
      .eq("user_id", toUserId)
      .single();

  if (newUserFetchError) {
    log(
      "Error fetching new user premium data for transfer:",
      newUserFetchError
    );
    throw newUserFetchError;
  }

  const newUserCurrentCredits = newUserData?.credits || 0;

  const { error: updateToError } = await supabaseAdminClient
    .from("user_premium")
    .update({
      premium_start: now,
      premium_finish: oldPremiumFinish,
      credits: newUserCurrentCredits + oldCredits,
      has_purchased: true,
      updated_at: now,
      next_charge_date: oldNextChargeDate,
      subscription_tier: oldSubscriptionTier,
      billing_period: oldBillingPeriod,
    })
    .eq("user_id", toUserId);

  if (updateToError) {
    log("Error updating new user premium data for transfer:", updateToError);
    throw updateToError;
  }

  const { error: transferCreditsError } = await supabaseAdminClient
    .from("scheduled_credits")
    .update({ user_id: toUserId })
    .eq("user_id", fromUserId)
    .eq("done", false);

  if (transferCreditsError) {
    log("Error transferring scheduled credits:", transferCreditsError);
  }

  log("Transferred subscription from user to user:", {
    fromUserId,
    toUserId,
    creditsTransferred: oldCredits,
  });
}

async function handleProductChange(
  _supabaseAdminClient: SupabaseClient,
  appUserId: string,
  event: RevenueCatEvent
): Promise<void> {
  log("Product change event (no action, handled by RENEWAL):", {
    appUserId,
    oldProductId: event.product_id,
    newProductId: event.new_product_id,
  });
}

async function updatePurchaseEmail(
  supabaseAdminClient: SupabaseClient,
  appUserId: string,
  email: string
): Promise<void> {
  const { error } = await supabaseAdminClient
    .from("user_technical_details")
    .update({
      purchase_email: email,
      updated_at: new Date(),
    })
    .eq("user_id", appUserId);

  if (error) {
    log("Error updating purchase_email in user_technical_details:", error);
    throw error;
  }
  log("Updated purchase_email for user:", { appUserId, email });
}

// TODO: Add webhook authorization
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseAdminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
    const event: RevenueCatEvent = body.event;
    const { type: eventType, app_user_id: appUserId } = event;

    log("Received webhook eventType, event, for user:", {
      eventType,
      event,
      appUserId,
    });

    switch (eventType) {
      case "INITIAL_PURCHASE":
      case "UNCANCELLATION":
      case "SUBSCRIPTION_EXTENDED":
      case "NON_RENEWING_PURCHASE":
        await handleSubscriptionPurchase(
          supabaseAdminClient,
          appUserId,
          event,
          false
        );
        break;
      case "RENEWAL":
        await handleSubscriptionPurchase(
          supabaseAdminClient,
          appUserId,
          event,
          true
        );
        break;
      case "TRANSFER":
        if (
          event.transferred_from &&
          event.transferred_to &&
          event.transferred_from.length > 0 &&
          event.transferred_to.length > 0
        ) {
          await handleSubscriptionTransfer(
            supabaseAdminClient,
            event.transferred_from[0],
            event.transferred_to[0],
            event
          );
        } else {
          log("Transfer event missing user IDs:", event);
        }
        break;
      case "EXPIRATION":
        await handleSubscriptionEnd(supabaseAdminClient, appUserId);
        break;
      case "REFUND":
        await handleSubscriptionRefund(supabaseAdminClient, appUserId, event);
        break;
      case "PRODUCT_CHANGE":
        await handleProductChange(supabaseAdminClient, appUserId, event);
        break;
      default:
        log("Unhandled event type:", eventType);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    log("Error processing webhook:", error);
    await alertError("revenue-cat-webhook", error);
    return new Response("Error", { status: 500 });
  }
});
