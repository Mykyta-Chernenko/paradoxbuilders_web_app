"use client";

import { useState, useCallback } from "react";
import { X, Star, PaperPlaneTilt, Envelope } from "@phosphor-icons/react";
import { submitFeedback } from "@/lib/surveys";
import AutoExpandingTextarea from "@/components/AutoExpandingTextarea";

export type SurveyType = "contact_support" | "report_bug" | "rate_quality";
export type BugCategory = "ui" | "performance" | "other";

interface SurveyModalProps {
  type: SurveyType;
  isOpen: boolean;
  onClose: () => void;
  supportEmail?: string;
  context?: {
    pageUrl?: string;
    [key: string]: unknown;
  };
}

export function SurveyModal({
  type,
  isOpen,
  onClose,
  supportEmail,
  context = {},
}: SurveyModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<BugCategory | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setRating(null);
    setMessage("");
    setEmail("");
    setCategory("");
    setIsSubmitting(false);
    setIsSubmitted(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const result = await submitFeedback({
      type,
      message,
      email: email || undefined,
      rating: rating || undefined,
      bugCategory: category || undefined,
      context,
    });

    setIsSubmitting(false);

    if (result.success) {
      setIsSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } else {
      setError(result.error || "Something went wrong. Please try again.");
    }
  }, [type, message, email, rating, category, context, handleClose]);

  if (!isOpen) return null;

  const titles: Record<SurveyType, string> = {
    contact_support: "Contact Support",
    report_bug: "Report a Bug",
    rate_quality: "Rate Your Experience",
  };

  const subtitles: Record<SurveyType, string> = {
    contact_support: "We'd love to hear from you",
    report_bug: "Help us improve by reporting issues",
    rate_quality: "Your feedback helps us get better",
  };

  const messagePlaceholders: Record<SurveyType, string> = {
    contact_support: "Describe your question or issue...",
    report_bug: "Describe the bug you encountered...",
    rate_quality: "Tell us about your experience...",
  };

  const bugCategories: { key: BugCategory; label: string }[] = [
    { key: "ui", label: "UI / Design" },
    { key: "performance", label: "Performance" },
    { key: "other", label: "Other" },
  ];

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <PaperPlaneTilt className="w-8 h-8 text-green-600" weight="fill" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-600">
            Your feedback has been submitted successfully.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {titles[type]}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{subtitles[type]}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {type === "contact_support" && supportEmail && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Envelope size={20} className="text-blue-600" weight="fill" />
            </div>
            <div className="text-sm">
              <p className="text-gray-700">You can also reach us at:</p>
              <a
                href={`mailto:${supportEmail}`}
                className="text-blue-600 font-medium hover:underline"
              >
                {supportEmail}
              </a>
            </div>
          </div>
        )}

        {type === "rate_quality" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Rating</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className={`p-2 rounded-lg transition-all ${
                    rating !== null && rating >= value
                      ? "text-amber-500"
                      : "text-gray-300 hover:text-amber-400"
                  }`}
                >
                  <Star
                    size={28}
                    weight={
                      rating !== null && rating >= value ? "fill" : "regular"
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {type === "report_bug" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Category</p>
            <div className="flex flex-wrap gap-2">
              {bugCategories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    category === cat.key
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {type === "rate_quality" ? "Feedback" : "Message"}
          </p>
          <AutoExpandingTextarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minRows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={messagePlaceholders[type]}
          />
        </div>

        {(type === "contact_support" || type === "report_bug") && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Email
              <span className="text-gray-400 font-normal ml-1">
                (optional)
              </span>
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className="px-5 py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <PaperPlaneTilt size={16} weight="bold" />
                Submit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
