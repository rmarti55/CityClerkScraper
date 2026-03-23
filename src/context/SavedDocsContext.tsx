"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface SavedDocKey {
  documentType: string;
  documentId: number;
}

interface SavedDocsContextValue {
  isAuthenticated: boolean;
  savedDocKeys: SavedDocKey[];
  loadingSavedDocs: boolean;
  isSaved: (documentType: string, documentId: number) => boolean;
  toggleSaveDocument: (params: {
    documentType: "file" | "attachment";
    documentId: number;
    eventId: number;
    agendaId?: number;
    documentName: string;
    documentCategory?: string;
  }) => Promise<boolean>;
  refetchSavedDocs: () => Promise<void>;
}

const SavedDocsContext = createContext<SavedDocsContextValue | null>(null);

function makeKey(documentType: string, documentId: number) {
  return `${documentType}:${documentId}`;
}

export function SavedDocsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [savedDocKeys, setSavedDocKeys] = useState<SavedDocKey[]>([]);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [loadingSavedDocs, setLoadingSavedDocs] = useState(true);

  const isAuthenticated = !!session?.user?.id;

  const fetchSavedDocs = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedDocKeys([]);
      setSavedSet(new Set());
      setLoadingSavedDocs(false);
      return;
    }
    setLoadingSavedDocs(true);
    try {
      const res = await fetch("/api/saved-docs");
      const data = await res.json();
      if (Array.isArray(data.docs)) {
        setSavedDocKeys(data.docs);
        setSavedSet(
          new Set(data.docs.map((d: SavedDocKey) => makeKey(d.documentType, d.documentId)))
        );
      }
    } catch {
      setSavedDocKeys([]);
      setSavedSet(new Set());
    } finally {
      setLoadingSavedDocs(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSavedDocs();
  }, [fetchSavedDocs]);

  const isSaved = useCallback(
    (documentType: string, documentId: number) => savedSet.has(makeKey(documentType, documentId)),
    [savedSet]
  );

  const toggleSaveDocument = useCallback(
    async (params: {
      documentType: "file" | "attachment";
      documentId: number;
      eventId: number;
      agendaId?: number;
      documentName: string;
      documentCategory?: string;
    }): Promise<boolean> => {
      if (!isAuthenticated) return false;

      const key = makeKey(params.documentType, params.documentId);
      const wasSaved = savedSet.has(key);
      const nextSaved = !wasSaved;

      // Optimistic update
      setSavedSet((prev) => {
        const next = new Set(prev);
        if (nextSaved) next.add(key);
        else next.delete(key);
        return next;
      });
      setSavedDocKeys((prev) => {
        if (nextSaved) {
          return [...prev, { documentType: params.documentType, documentId: params.documentId }];
        }
        return prev.filter(
          (d) => !(d.documentType === params.documentType && d.documentId === params.documentId)
        );
      });

      try {
        if (nextSaved) {
          const res = await fetch("/api/saved-docs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          });
          if (!res.ok) throw new Error("Failed to save document");
        } else {
          const res = await fetch(
            `/api/saved-docs?documentType=${params.documentType}&documentId=${params.documentId}`,
            { method: "DELETE" }
          );
          if (!res.ok) throw new Error("Failed to unsave document");
        }
        return true;
      } catch {
        // Rollback
        setSavedSet((prev) => {
          const next = new Set(prev);
          if (nextSaved) next.delete(key);
          else next.add(key);
          return next;
        });
        setSavedDocKeys((prev) => {
          if (nextSaved) {
            return prev.filter(
              (d) => !(d.documentType === params.documentType && d.documentId === params.documentId)
            );
          }
          return [...prev, { documentType: params.documentType, documentId: params.documentId }];
        });
        return false;
      }
    },
    [isAuthenticated, savedSet]
  );

  const value: SavedDocsContextValue = {
    isAuthenticated,
    savedDocKeys,
    loadingSavedDocs,
    isSaved,
    toggleSaveDocument,
    refetchSavedDocs: fetchSavedDocs,
  };

  return (
    <SavedDocsContext.Provider value={value}>{children}</SavedDocsContext.Provider>
  );
}

export function useSavedDocs(): SavedDocsContextValue {
  const ctx = useContext(SavedDocsContext);
  if (!ctx) {
    throw new Error("useSavedDocs must be used within a SavedDocsProvider");
  }
  return ctx;
}
