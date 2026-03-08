"use client";

import { useEffect, useRef, TextareaHTMLAttributes } from "react";

interface AutoExpandingTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

export default function AutoExpandingTextarea({
  value,
  onChange,
  minRows = 2,
  className = "",
  ...props
}: AutoExpandingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const minHeight = minRows * 24;
      textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
    }
  }, [value, minRows]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = "auto";
    const minHeight = minRows * 24;
    textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
    onChange?.(e);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      className={`resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}
