import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient, getUserIdFromRequest } from "../_shared/db.ts";
import { log, alertError } from "../_shared/utils.ts";

interface FeedbackRequest {
  type: "contact_support" | "report_bug" | "rate_quality";
  message: string;
  email?: string;
  rating?: number;
  bugCategory?: string;
  pageUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromRequest(req);

    let body: FeedbackRequest;
    try {
      const rawText = await req.text();
      if (!rawText || rawText.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Request body is empty" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      body = JSON.parse(rawText);
    } catch (_parseError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.type || !body.message) {
      return new Response(
        JSON.stringify({ error: "type and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validTypes = ["contact_support", "report_bug", "rate_quality"];
    if (!validTypes.includes(body.type)) {
      return new Response(JSON.stringify({ error: "Invalid feedback type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
      return new Response(
        JSON.stringify({ error: "Rating must be between 1 and 5" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();
    const userAgent = req.headers.get("user-agent") || null;

    let isUserPremium = false;
    if (userId) {
      const { data: premiumData } = await supabase
        .from("user_premium")
        .select("has_purchased")
        .eq("user_id", userId)
        .maybeSingle();
      if (premiumData?.has_purchased) {
        isUserPremium = true;
      }
    }

    const { data, error } = await supabase
      .from("user_feedback")
      .insert({
        user_id: userId,
        type: body.type,
        message: body.message,
        email: body.email || null,
        rating: body.rating || null,
        bug_category: body.bugCategory || null,
        page_url: body.pageUrl || null,
        user_agent: userAgent,
        is_user_premium: isUserPremium,
      })
      .select()
      .single();

    if (error) {
      log("Error inserting feedback:", error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("Error in user-feedback-submit:", error);
    await alertError("user-feedback-submit", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
