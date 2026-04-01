"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
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
  displayName: string | null;
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

function SavedDocCard({
  doc,
  onUnsave,
  onRename,
}: {
  doc: SavedDocDetail;
  onUnsave: (doc: SavedDocDetail) => void;
  onRename: (doc: SavedDocDetail, newName: string) => void;
}) {
  const viewUrl = getViewUrl(doc);
  const downloadUrl = getDownloadUrl(doc);
  const chatUrl = getChatUrl(doc);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const title = doc.displayName || doc.documentName;
  const hasCustomTitle = doc.displayName && doc.displayName !== doc.documentName;

  function startEditing() {
    setEditValue(title);
    setIsEditing(true);
    setTimeout(() => editInputRef.current?.select(), 0);
  }

  function commitEdit() {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(doc, trimmed);
    }
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  return (
    <DocumentCardWrapper pdfUrl={viewUrl}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="w-full font-semibold text-gray-900 text-[15px] leading-tight bg-white border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <h3
              className="font-semibold text-gray-900 text-[15px] leading-tight cursor-pointer hover:text-indigo-700 transition-colors"
              onDoubleClick={startEditing}
              title="Double-click to edit title"
            >
              {title}
            </h3>
          )}
          {hasCustomTitle && !isEditing && (
            <p className="text-xs text-gray-400 mt-0.5 truncate" title={doc.documentName}>
              {doc.documentName}
            </p>
          )}
          {doc.documentCategory && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${getTypeBadgeColor(doc.documentCategory)}`}>
                {doc.documentCategory}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-gray-500">
            {doc.eventName && (
              <Link
                href={`/meeting/${doc.eventId}`}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
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

const savedDocsFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load");
    return r.json() as Promise<{ docs?: SavedDocDetail[] }>;
  });

function SavedDocsInner() {
  const { status } = useSession();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated, toggleSaveDocument, refetchSavedDocs } = useSavedDocs();

  const { data, error: swrError, isLoading: loading, mutate } = useSWR(
    isAuthenticated ? "/api/saved-docs?detail=true" : null,
    savedDocsFetcher,
  );

  const docs = data?.docs ?? [];
  const error = swrError
    ? "Couldn't load saved documents. Check your connection and try again."
    : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"saved-newest" | "meeting-newest" | "meeting-oldest">("saved-newest");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      [doc.documentName, doc.displayName, doc.eventName, doc.categoryName, doc.documentCategory]
        .some((field) => field?.toLowerCase().includes(q))
    );
  }, [docs, searchQuery]);

  const sortedDocs = useMemo(() => {
    if (sortOption === "saved-newest") return filteredDocs;
    const sorted = [...filteredDocs].sort((a, b) => {
      const aDate = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
      const bDate = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
      if (!a.startDateTime && !b.startDateTime) return 0;
      if (!a.startDateTime) return 1;
      if (!b.startDateTime) return -1;
      return sortOption === "meeting-newest" ? bDate - aDate : aDate - bDate;
    });
    return sorted;
  }, [filteredDocs, sortOption]);

  const handleUnsave = useCallback(
    async (doc: SavedDocDetail) => {
      mutate(
        (prev) => prev ? { docs: prev.docs?.filter((d) => d.id !== doc.id) } : prev,
        false,
      );
      const ok = await toggleSaveDocument({
        documentType: doc.documentType as "file" | "attachment",
        documentId: doc.documentId,
        eventId: doc.eventId,
        agendaId: doc.agendaId ?? undefined,
        documentName: doc.documentName,
        documentCategory: doc.documentCategory ?? undefined,
      });
      if (!ok) {
        mutate();
      } else {
        refetchSavedDocs();
      }
    },
    [toggleSaveDocument, mutate, refetchSavedDocs]
  );

  const handleRename = useCallback(
    async (doc: SavedDocDetail, newName: string) => {
      mutate(
        (prev) =>
          prev
            ? {
                docs: prev.docs?.map((d) =>
                  d.id === doc.id ? { ...d, displayName: newName } : d,
                ),
              }
            : prev,
        false,
      );
      try {
        const res = await fetch("/api/saved-docs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: doc.documentType,
            documentId: doc.documentId,
            displayName: newName,
          }),
        });
        if (!res.ok) mutate();
      } catch {
        mutate();
      }
    },
    [mutate],
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
          onClick={() => mutate()}
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
        <svg className="w-12 h-12 text-gray-900 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-600">
          {isFiltering
            ? `${sortedDocs.length} of ${docs.length} saved document${docs.length !== 1 ? "s" : ""}`
            : `${docs.length} saved document${docs.length !== 1 ? "s" : ""}`}
        </p>
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
          className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
        >
          <option value="saved-newest">Date Saved</option>
          <option value="meeting-newest">Meeting Date (Newest)</option>
          <option value="meeting-oldest">Meeting Date (Oldest)</option>
        </select>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {sortedDocs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-500 text-sm">
            No documents matching &ldquo;{searchQuery.trim()}&rdquo;
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sortedDocs.map((doc) => (
            <SavedDocCard key={doc.id} doc={doc} onUnsave={handleUnsave} onRename={handleRename} />
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
