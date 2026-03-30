"use client";

import { useSavedDocs } from "@/context/SavedDocsContext";
import { useLoginModal } from "@/context/LoginModalContext";
import { BookmarkFilledIcon, BookmarkOutlineIcon } from "./icons";

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
          : "text-gray-900 hover:bg-amber-50"
      }`}
    >
      {saved ? (
        <BookmarkFilledIcon className="w-4 h-4" />
      ) : (
        <BookmarkOutlineIcon className="w-4 h-4" />
      )}
    </button>
  );
}
