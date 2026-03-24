"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLoginModal } from "@/context/LoginModalContext";
import { useSavedDocs } from "@/context/SavedDocsContext";
import { DocumentViewerProvider } from "@/context/DocumentViewerContext";
import { MeetingDetailLayout } from "@/components/MeetingDetailLayout";
import { ViewDocumentButton } from "@/components/ViewDocumentButton";
import { DocumentCardWrapper } from "@/components/DocumentCardWrapper";
import { formatEventDate } from "@/lib/utils";

interface SavedDocDetail {
  id: number;
  documentType: string;
  documentId: number;
  eventId: number;
  agendaId: number | null;
  documentName: string;
  documentCategory: string | null;
  createdAt: string;
  eventName: string | null;
  eventDate: string | null;
  startDateTime: string | null;
  categoryName: string | null;
}

function getViewUrl(doc: SavedDocDetail): string {
  if (doc.documentType === "attachment" && doc.agendaId) {
    return `/api/attachment/${doc.documentId}?agendaId=${doc.agendaId}`;
  }
  return `/api/file/${doc.documentId}`;
}

function getDownloadUrl(doc: SavedDocDetail): string {
  const base = getViewUrl(doc);
  return `${base}${base.includes("?") ? "&" : "?"}download=true&name=${encodeURIComponent(doc.documentName)}`;
}

function getChatUrl(doc: SavedDocDetail): string {
  if (doc.documentType === "attachment") {
    return `/meeting/${doc.eventId}/attachment/${doc.documentId}?name=${encodeURIComponent(doc.documentName)}`;
  }
  return `/meeting/${doc.eventId}/file/${doc.documentId}?name=${encodeURIComponent(doc.documentName)}`;
}

function getTypeBadgeColor(type: string | null): string {
  if (!type) return "bg-gray-100 text-gray-800";
  const t = type.toLowerCase();
  if (t.includes("agenda") && t.includes("packet")) return "bg-blue-100 text-blue-700";
  if (t.includes("agenda")) return "bg-green-100 text-green-700";
  if (t.includes("minutes")) return "bg-purple-100 text-purple-700";
  if (t.includes("video")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-800";
}

function SavedDocCard({ doc, onUnsave }: { doc: SavedDocDetail; onUnsave: (doc: SavedDocDetail) => void }) {
  const viewUrl = getViewUrl(doc);
  const downloadUrl = getDownloadUrl(doc);
  const chatUrl = getChatUrl(doc);

  return (
    <DocumentCardWrapper pdfUrl={viewUrl}>
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
          <path d="M8 12h8v2H8zM8 15h8v2H8z" />
        </svg>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-[15px] leading-tight truncate">
            {doc.documentName}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {doc.documentCategory && (
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${getTypeBadgeColor(doc.documentCategory)}`}>
                {doc.documentCategory}
              </span>
            )}
            {doc.documentType === "attachment" && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap bg-orange-100 text-orange-700">
                Attachment
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-gray-500">
            {doc.eventName && (
              <Link
                href={`/meeting/${doc.eventId}`}
                className="text-indigo-600 hover:text-indigo-700 font-medium truncate max-w-[200px]"
                title={doc.eventName}
              >
                {doc.eventName}
              </Link>
            )}
            {doc.startDateTime && (
              <span className="whitespace-nowrap">{formatEventDate(doc.startDateTime)}</span>
            )}
            {doc.categoryName && (
              <span className="whitespace-nowrap text-gray-400">{doc.categoryName}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onUnsave(doc)}
            title="Unsave document"
            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
            </svg>
          </button>
          <Link
            href={chatUrl}
            title="Chat with AI"
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>
          <ViewDocumentButton url={viewUrl} title={doc.documentName} />
          <a
            href={downloadUrl}
            title="Download"
            className="p-1.5 text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>
    </DocumentCardWrapper>
  );
}

function SavedDocsInner() {
  const { status } = useSession();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated, toggleSaveDocument, refetchSavedDocs } = useSavedDocs();

  const [docs, setDocs] = useState<SavedDocDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      [doc.documentName, doc.eventName, doc.categoryName, doc.documentCategory]
        .some((field) => field?.toLowerCase().includes(q))
    );
  }, [docs, searchQuery]);

  const fetchDocs = useCallback(async () => {
    if (!isAuthenticated) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-docs?detail=true");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDocs(data.docs ?? []);
    } catch {
      setDocs([]);
      setError("Couldn't load saved documents. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUnsave = useCallback(
    async (doc: SavedDocDetail) => {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      const ok = await toggleSaveDocument({
        documentType: doc.documentType as "file" | "attachment",
        documentId: doc.documentId,
        eventId: doc.eventId,
        agendaId: doc.agendaId ?? undefined,
        documentName: doc.documentName,
        documentCategory: doc.documentCategory ?? undefined,
      });
      if (!ok) {
        fetchDocs();
      } else {
        refetchSavedDocs();
      }
    },
    [toggleSaveDocument, fetchDocs, refetchSavedDocs]
  );

  if (status === "loading" || (isAuthenticated && loading)) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-20 bg-gray-200 rounded" />
        <div className="h-20 bg-gray-200 rounded" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Saved Documents</h2>
        <p className="text-gray-800 mb-6">
          Sign in to save and access your bookmarked documents.
        </p>
        <button
          onClick={openLoginModal}
          className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-800 mb-3">{error}</p>
        <button
          type="button"
          onClick={fetchDocs}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <p className="text-gray-600 mb-4">
          No saved documents yet. Browse meetings and tap the bookmark icon to save documents here.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700"
        >
          Browse meetings
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    );
  }

  const isFiltering = searchQuery.trim().length > 0;

  return (
    <div>
      <p className="text-gray-600 mb-3">
        {isFiltering
          ? `${filteredDocs.length} of ${docs.length} saved document${docs.length !== 1 ? "s" : ""}`
          : `${docs.length} saved document${docs.length !== 1 ? "s" : ""}`}
      </p>

      {/* Search input */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search saved documents..."
          className="block w-full pl-9 pr-9 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              searchInputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {filteredDocs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-500 text-sm">
            No documents matching &ldquo;{searchQuery.trim()}&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => (
            <SavedDocCard key={doc.id} doc={doc} onUnsave={handleUnsave} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SavedDocsTabContent() {
  return (
    <DocumentViewerProvider>
      <MeetingDetailLayout>
        <SavedDocsInner />
      </MeetingDetailLayout>
    </DocumentViewerProvider>
  );
}
