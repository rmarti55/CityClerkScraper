"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/context/ToastContext";

interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = "Copied!" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        showToast(label);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        showToast("Unable to copy");
      }
    },
    [value, label, showToast],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-auto p-0.5 rounded text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
      title={`Copy ${value}`}
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5 text-teal-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
