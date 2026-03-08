"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type ProgressType = "default";

interface ExponentialProgressBarProps {
  stepSize?: number;
  isOpen: boolean;
  onComplete?: () => void;
  type?: ProgressType;
  title?: string;
  subtitle?: string;
  steps?: string[];
}

const DEFAULT_STEPS = [
  "Initializing...",
  "Processing...",
  "Building...",
  "Finalizing...",
  "Almost done...",
];

export default function ExponentialProgressBar({
  stepSize = 10,
  isOpen,
  onComplete,
  title = "Processing",
  subtitle = "This may take a moment",
  steps = DEFAULT_STEPS,
}: ExponentialProgressBarProps) {
  const [progress, setProgress] = useState(0);

  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
    }
  }, [isOpen]);

  const calculateTimeForStep = useCallback(
    (currentProgress: number): number => {
      if (currentProgress >= 95) {
        return 20000;
      }

      const stepNumber = Math.floor(currentProgress / stepSize);
      return 500 * Math.pow(1.15, stepNumber);
    },
    [stepSize]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (progress >= 100) {
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
      return;
    }

    const delay = calculateTimeForStep(progress);

    const timer = setTimeout(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        return p + 1;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [isOpen, progress, calculateTimeForStep]);

  if (!isOpen) return null;

  const getStepText = () => {
    const stepCount = steps.length;
    const stepSize = 100 / stepCount;
    const stepIndex = Math.min(
      Math.floor(progress / stepSize),
      stepCount - 1
    );
    return steps[stepIndex];
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
            <svg
              className="w-8 h-8 text-white animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-gray-700">Progress</span>
            <span className="font-bold text-blue-600">{progress}%</span>
          </div>

          <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse" />
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        <p className="text-sm font-medium text-center text-blue-600 animate-pulse">
          {getStepText()}
        </p>
      </div>
    </div>
  );
}
