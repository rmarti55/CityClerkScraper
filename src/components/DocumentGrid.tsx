"use client";

import { ReactNode } from "react";
import { useDocumentViewer } from "@/context/DocumentViewerContext";

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export function DocumentGrid({ count, children }: { count: number; children: ReactNode }) {
  const { viewerState } = useDocumentViewer();
  const isViewerOpen = viewerState.pdfUrl !== null;
  const cols = isViewerOpen ? "" : (GRID_COLS[Math.min(count, 4)] ?? "md:grid-cols-4");

  return (
    <div className={`grid grid-cols-1 ${cols} gap-2`}>
      {children}
    </div>
  );
}
