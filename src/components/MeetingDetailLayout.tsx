"use client";

import { ReactNode } from "react";
import { useDocumentViewer } from "@/context/DocumentViewerContext";
import { InlineDocumentViewer } from "@/components/InlineDocumentViewer";

export function MeetingDetailLayout({ children }: { children: ReactNode }) {
  const { viewerState } = useDocumentViewer();
  const isOpen = viewerState.pdfUrl !== null;

  return (
    <main className={isOpen ? "h-screen overflow-hidden bg-gray-50" : "min-h-screen bg-gray-50"}>
      {/* Single-column on mobile always; split on desktop when viewer is open */}
      <div className={isOpen ? "lg:flex lg:h-[calc(100vh-84px)] lg:overflow-hidden" : ""}>
        <div
          className={
            isOpen
              ? "max-w-4xl mx-auto px-4 py-6 lg:max-w-none lg:mx-0 lg:w-1/2 lg:overflow-y-auto lg:shrink-0"
              : "max-w-4xl mx-auto px-4 py-6"
          }
        >
          {children}
        </div>
        {isOpen && (
          <div className="lg:w-1/2 lg:shrink-0 lg:h-full lg:overflow-hidden">
            <InlineDocumentViewer />
          </div>
        )}
      </div>
    </main>
  );
}
