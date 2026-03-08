import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function getUserIdFromRequest(
  req: Request
): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export async function getUserCredits(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_premium")
    .select("credits")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data?.credits || 0;
}

export async function hasUserPurchased(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_premium")
    .select("has_purchased")
    .eq("user_id", userId)
    .single();

  if (error) return false;
  return data?.has_purchased || false;
}

export async function deductUserCredits(
  userId: string,
  amount: number
): Promise<void> {
  const supabase = getSupabaseClient();
  const currentCredits = await getUserCredits(userId);
  const newCredits = Math.max(0, currentCredits - amount);

  const { error: updateError } = await supabase
    .from("user_premium")
    .update({ credits: newCredits })
    .eq("user_id", userId);

  if (updateError) throw updateError;
}

export async function checkAndDeductCredits(
  userId: string,
  requiredCredits: number
): Promise<{
  success: boolean;
  currentCredits: number;
  requiredCredits: number;
}> {
  const currentCredits = await getUserCredits(userId);

  if (currentCredits < requiredCredits) {
    return { success: false, currentCredits, requiredCredits };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("user_premium")
    .update({ credits: currentCredits - requiredCredits })
    .eq("user_id", userId);

  if (error) throw error;

  return {
    success: true,
    currentCredits: currentCredits - requiredCredits,
    requiredCredits,
  };
}
