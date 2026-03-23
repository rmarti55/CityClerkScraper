"use client";

import { useSavedDocs } from "@/context/SavedDocsContext";
import { useLoginModal } from "@/context/LoginModalContext";

interface SaveDocumentButtonProps {
  documentType: "file" | "attachment";
  documentId: number;
  eventId: number;
  agendaId?: number;
  documentName: string;
  documentCategory?: string;
}

export function SaveDocumentButton({
  documentType,
  documentId,
  eventId,
  agendaId,
  documentName,
  documentCategory,
}: SaveDocumentButtonProps) {
  const { isAuthenticated, isSaved, toggleSaveDocument } = useSavedDocs();
  const { openLoginModal } = useLoginModal();

  const saved = isSaved(documentType, documentId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    await toggleSaveDocument({
      documentType,
      documentId,
      eventId,
      agendaId,
      documentName,
      documentCategory,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={saved ? "Unsave document" : "Save document"}
      className={`p-1.5 rounded transition-colors ${
        saved
          ? "text-amber-500 hover:bg-amber-50"
          : "text-gray-400 hover:text-amber-500 hover:bg-amber-50"
      }`}
    >
      {saved ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      )}
    </button>
  );
}
