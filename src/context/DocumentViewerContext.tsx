"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface ViewerState {
  pdfUrl: string | null;
  title: string | null;
  chatEndpoint: string | null;
}

function deriveChatEndpoint(pdfUrl: string): string {
  const qIndex = pdfUrl.indexOf("?");
  if (qIndex === -1) return `${pdfUrl}/chat`;
  return `${pdfUrl.slice(0, qIndex)}/chat${pdfUrl.slice(qIndex)}`;
}

interface DocumentViewerContextValue {
  viewerState: ViewerState;
  openDocument: (url: string, title: string) => void;
  closeDocument: () => void;
}

const DocumentViewerContext = createContext<DocumentViewerContextValue | null>(null);

export function DocumentViewerProvider({ children }: { children: ReactNode }) {
  const [viewerState, setViewerState] = useState<ViewerState>({
    pdfUrl: null,
    title: null,
    chatEndpoint: null,
  });

  const openDocument = useCallback((url: string, title: string) => {
    setViewerState({ pdfUrl: url, title, chatEndpoint: deriveChatEndpoint(url) });
  }, []);

  const closeDocument = useCallback(() => {
    setViewerState({ pdfUrl: null, title: null, chatEndpoint: null });
  }, []);

  return (
    <DocumentViewerContext.Provider value={{ viewerState, openDocument, closeDocument }}>
      {children}
    </DocumentViewerContext.Provider>
  );
}

export function useDocumentViewer() {
  const ctx = useContext(DocumentViewerContext);
  if (!ctx) {
    throw new Error("useDocumentViewer must be used within a DocumentViewerProvider");
  }
  return ctx;
}
