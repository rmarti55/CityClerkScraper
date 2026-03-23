"use client";

import { useState } from "react";
import { useDocumentViewer } from "@/context/DocumentViewerContext";
import { InlineDocumentChat } from "@/components/InlineDocumentChat";

export function InlineDocumentViewer() {
  const { viewerState, closeDocument } = useDocumentViewer();
  const [chatOpen, setChatOpen] = useState(false);

  if (!viewerState.pdfUrl) return null;

  return (
    <div className="hidden lg:flex flex-col h-full border-l border-gray-200 bg-gray-100">
      {/* Document title bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-800 truncate" title={viewerState.title ?? undefined}>
            {viewerState.title ?? "Document"}
          </h3>
        </div>
        <button
          type="button"
          onClick={closeDocument}
          className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close document viewer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* PDF iframe — takes remaining space, shrinks when chat is open */}
      <div className={chatOpen ? "h-[55%] shrink-0" : "flex-1 min-h-0"}>
        <iframe
          src={viewerState.pdfUrl}
          title={viewerState.title ?? "PDF Document"}
          className="w-full h-full"
        />
      </div>

      {/* Chat toggle bar */}
      <button
        type="button"
        onClick={() => setChatOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 bg-white border-t border-b border-gray-200 shrink-0 hover:bg-gray-50 transition-colors w-full text-left"
      >
        <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-sm font-medium text-gray-800 flex-1">Chat with document</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${chatOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Chat panel — collapsible */}
      {chatOpen && viewerState.chatEndpoint && (
        <div className="h-[45%] shrink-0 min-h-0">
          <InlineDocumentChat chatEndpoint={viewerState.chatEndpoint} />
        </div>
      )}
    </div>
  );
}
