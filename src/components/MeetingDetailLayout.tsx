"use client";

import { ReactNode, useLayoutEffect, useRef } from "react";
import { useDocumentViewer } from "@/context/DocumentViewerContext";
import { InlineDocumentViewer } from "@/components/InlineDocumentViewer";

export function MeetingDetailLayout({ children }: { children: ReactNode }) {
  const { viewerState } = useDocumentViewer();
  const isOpen = viewerState.pdfUrl !== null;

  const leftColumnRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);
  const wasOpenRef = useRef(false);

  // Capture window scroll position before the layout switches to the split view
  if (isOpen && !wasOpenRef.current) {
    savedScrollRef.current = window.scrollY;
  }

  // Restore scroll position into the new left-column scroll container
  useLayoutEffect(() => {
    if (isOpen && !wasOpenRef.current && leftColumnRef.current) {
      leftColumnRef.current.scrollTop = savedScrollRef.current;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  return (
    <main className={isOpen ? "h-[calc(100vh-84px)] overflow-hidden bg-gray-50" : "min-h-screen bg-gray-50"}>
      {/* Single-column on mobile always; split on desktop when viewer is open */}
      <div className={isOpen ? "lg:flex lg:h-full lg:overflow-hidden" : ""}>
        <div
          ref={leftColumnRef}
          className={
            isOpen
              ? "max-w-4xl mx-auto px-4 py-6 lg:max-w-none lg:mx-0 lg:px-12 lg:w-1/2 lg:overflow-y-auto lg:shrink-0"
              : "max-w-4xl mx-auto px-4 py-6 lg:max-w-none lg:px-12"
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
