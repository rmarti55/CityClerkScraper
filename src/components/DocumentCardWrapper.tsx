"use client";

import { ReactNode } from "react";
import { useDocumentViewer } from "@/context/DocumentViewerContext";

interface DocumentCardWrapperProps {
  pdfUrl: string;
  children: ReactNode;
}

export function DocumentCardWrapper({ pdfUrl, children }: DocumentCardWrapperProps) {
  const { viewerState } = useDocumentViewer();
  const isActive = viewerState.pdfUrl === pdfUrl;

  return (
    <div
      className={`bg-white border rounded-lg px-3 py-2.5 transition-colors ${
        isActive
          ? "border-indigo-400 ring-1 ring-indigo-200"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {children}
    </div>
  );
}
