"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChatCircleDots, CaretUp, CaretDown } from "@phosphor-icons/react";
import {
  FeedbackResponse,
  fetchPendingFeedbackResponse,
  closeFeedbackResponse,
} from "@/lib/surveys";
import { useAuth } from "@/contexts/AuthContext";

export function FeedbackResponsePopup() {
  const { isAuthenticated, loading } = useAuth();
  const [response, setResponse] = useState<FeedbackResponse | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && !hasFetched) {
      setHasFetched(true);
      fetchPendingFeedbackResponse().then((result) => {
        if (result.response) {
          setResponse(result.response);
        }
      });
    }
  }, [loading, isAuthenticated, hasFetched]);

  const handleClose = useCallback(async () => {
    if (!response || isClosing) return;

    setIsClosing(true);
    const result = await closeFeedbackResponse(response.id);
    if (result.success) {
      setResponse(null);
    }
    setIsClosing(false);
  }, [response, isClosing]);

  if (!response) return null;

  const getFeedbackTypeLabel = () => {
    switch (response.originalFeedback?.type) {
      case "contact_support":
        return "Support Request";
      case "report_bug":
        return "Bug Report";
      case "rate_quality":
        return "Quality Rating";
      default:
        return "Feedback";
    }
  };

  return (
    <div
      className="fixed bottom-4 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 transition-all duration-300"
      style={{ width: isExpanded ? "380px" : "320px" }}
    >
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ChatCircleDots
                size={16}
                className="text-blue-600"
                weight="fill"
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                New Response
              </h4>
              <p className="text-xs text-gray-500">
                We replied to your feedback
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
            >
              {isExpanded ? <CaretDown size={16} /> : <CaretUp size={16} />}
            </button>
            <button
              onClick={handleClose}
              disabled={isClosing}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isExpanded && response.originalFeedback && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-medium rounded">
                {getFeedbackTypeLabel()}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-1">Your message:</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-3">
              {response.originalFeedback.message}
            </p>
          </div>
        )}

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-600 font-medium mb-1">
            Our response:
          </p>
          <p
            className={`text-sm text-gray-700 whitespace-pre-wrap ${
              !isExpanded ? "line-clamp-3" : ""
            }`}
          >
            {response.responseMessage}
          </p>
        </div>

        <button
          onClick={handleClose}
          disabled={isClosing}
          className="w-full px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClosing ? "Closing..." : "Got it"}
        </button>
      </div>
    </div>
  );
}
