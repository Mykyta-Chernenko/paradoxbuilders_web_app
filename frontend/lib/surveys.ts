import { supabase } from "@/lib/supabase";

export type SurveyType = "contact_support" | "report_bug" | "rate_quality";
export type BugCategory = "ui" | "performance" | "other";

export interface SurveyContext {
  stage?: string;
  pageUrl?: string;
}

export interface FeedbackSubmission {
  type: SurveyType;
  message: string;
  email?: string;
  rating?: number;
  bugCategory?: BugCategory;
  context?: SurveyContext;
}

export interface FeedbackResponse {
  id: number;
  responseMessage: string;
  createdAt: string;
  originalFeedback: {
    id: number;
    type: SurveyType;
    message: string;
    createdAt: string;
  } | null;
}

export const fetchPendingFeedbackResponse = async (): Promise<{
  response: FeedbackResponse | null;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase
      .from("user_feedback_response")
      .select(
        `
        id,
        response_message,
        created_at,
        feedback:user_feedback!feedback_id (
          id,
          type,
          message,
          created_at
        )
      `
      )
      .eq("closed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return { response: null };
    }

    const feedbackData = data.feedback as unknown as {
      id: number;
      type: SurveyType;
      message: string;
      created_at: string;
    } | null;

    return {
      response: {
        id: data.id,
        responseMessage: data.response_message,
        createdAt: data.created_at,
        originalFeedback: feedbackData
          ? {
              id: feedbackData.id,
              type: feedbackData.type,
              message: feedbackData.message,
              createdAt: feedbackData.created_at,
            }
          : null,
      },
    };
  } catch (error) {
    console.error("Failed to fetch feedback response:", error);
    return {
      response: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const closeFeedbackResponse = async (
  responseId: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from("user_feedback_response")
      .update({ closed: true })
      .eq("id", responseId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to close feedback response:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const submitFeedback = async (
  feedback: FeedbackSubmission
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user-feedback-submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          type: feedback.type,
          message: (feedback.message || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""),
          email: feedback.email,
          rating: feedback.rating,
          bugCategory: feedback.bugCategory,
          stage: feedback.context?.stage,
          pageUrl:
            feedback.context?.pageUrl ||
            (typeof window !== "undefined" ? window.location.href : ""),
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to submit feedback");
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
