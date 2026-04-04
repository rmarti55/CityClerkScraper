"use client";

import { useState, useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";

interface DocFile {
  fileId: number;
  name: string;
  type: string;
  publishOn: string | null;
  fileSize: number | null;
  pageCount: number | null;
}

interface DocMeeting {
  eventId: number;
  eventName: string;
  eventDate: string;
  startDateTime: string;
  agendaId: number | null;
  files: DocFile[];
}

interface DocumentsResponse {
  meetings: DocMeeting[];
  totalMeetings: number;
  totalFiles: number;
  page: number;
  totalPages: number;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch documents");
    return r.json() as Promise<DocumentsResponse>;
  });

function getFileTypeBadgeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("agenda") && t.includes("packet")) return "bg-blue-100 text-blue-700";
  if (t.includes("agenda")) return "bg-green-100 text-green-700";
  if (t.includes("minutes")) return "bg-purple-100 text-purple-700";
  if (t.includes("video")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-800";
}

function formatFileSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Collect unique file types across all loaded meetings
function collectFileTypes(meetings: DocMeeting[]): string[] {
  const types = new Set<string>();
  for (const m of meetings) {
    for (const f of m.files) {
      types.add(f.type);
    }
  }
  return Array.from(types).sort();
}

interface CommitteeDocumentBrowserProps {
  categoryName: string;
  committeeSlug: string;
}

export function CommitteeDocumentBrowser({
  categoryName,
  committeeSlug,
}: CommitteeDocumentBrowserProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    phase: "fetching" | "zipping" | "idle";
    fetched: number;
    total: number;
    currentFile: string;
  }>({ phase: "idle", fetched: 0, total: 0, currentFile: "" });

  const limit = 20;

  const getKey = useCallback(
    (pageIndex: number, previousPageData: DocumentsResponse | null) => {
      if (!isOpen) return null;
      if (previousPageData && pageIndex >= previousPageData.totalPages) return null;
      return `/api/events/by-committee/documents?categoryName=${encodeURIComponent(categoryName)}&limit=${limit}&page=${pageIndex + 1}`;
    },
    [isOpen, categoryName]
  );

  const { data: pages, error, isLoading, isValidating, size, setSize } =
    useSWRInfinite<DocumentsResponse>(getKey, fetcher);

  const allMeetings = useMemo(() => {
    if (!pages) return [];
    const result: DocMeeting[] = [];
    const seen = new Set<number>();
    for (const page of pages) {
      for (const m of page.meetings) {
        if (!seen.has(m.eventId)) {
          seen.add(m.eventId);
          result.push(m);
        }
      }
    }
    return result;
  }, [pages]);

  const fileTypes = useMemo(() => collectFileTypes(allMeetings), [allMeetings]);

  const allFiles = useMemo(() => {
    const result: { file: DocFile; meeting: DocMeeting }[] = [];
    for (const m of allMeetings) {
      for (const f of m.files) {
        if (typeFilter && f.type !== typeFilter) continue;
        result.push({ file: f, meeting: m });
      }
    }
    return result;
  }, [allMeetings, typeFilter]);

  const meetingsWithFiles = useMemo(
    () => allMeetings.filter((m) => m.files.length > 0).length,
    [allMeetings]
  );

  const fileKey = (fileId: number) => `file-${fileId}`;

  const toggleFile = useCallback((fileId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = fileKey(fileId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleMeeting = useCallback((meeting: DocMeeting) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const meetingFiles = meeting.files.filter((f) => !typeFilter || f.type === typeFilter);
      const allSelected = meetingFiles.every((f) => prev.has(fileKey(f.fileId)));
      for (const f of meetingFiles) {
        if (allSelected) {
          next.delete(fileKey(f.fileId));
        } else {
          next.add(fileKey(f.fileId));
        }
      }
      return next;
    });
  }, [typeFilter]);

  const selectAll = useCallback(() => {
    setSelected((prev) => {
      const allKeys = allFiles.map(({ file }) => fileKey(file.fileId));
      const allSelected = allKeys.every((k) => prev.has(k));
      if (allSelected) {
        const next = new Set(prev);
        for (const k of allKeys) next.delete(k);
        return next;
      }
      return new Set([...prev, ...allKeys]);
    });
  }, [allFiles]);

  const selectByType = useCallback((type: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const typeFiles = allFiles.filter(({ file }) => file.type === type);
      const allSelected = typeFiles.every(({ file }) => prev.has(fileKey(file.fileId)));
      for (const { file } of typeFiles) {
        if (allSelected) {
          next.delete(fileKey(file.fileId));
        } else {
          next.add(fileKey(file.fileId));
        }
      }
      return next;
    });
  }, [allFiles]);

  const toggleMeetingExpanded = useCallback((eventId: number) => {
    setExpandedMeetings((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const selectedCount = selected.size;
  const allVisibleSelected = allFiles.length > 0 && allFiles.every(({ file }) => selected.has(fileKey(file.fileId)));

  const handleDownload = useCallback(async () => {
    if (selectedCount === 0) return;
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ phase: "idle", fetched: 0, total: 0, currentFile: "" });
    try {
      const selectedFiles: { fileId: number; name: string }[] = [];
      for (const m of allMeetings) {
        for (const f of m.files) {
          if (selected.has(fileKey(f.fileId))) {
            selectedFiles.push({ fileId: f.fileId, name: f.name });
          }
        }
      }

      if (selectedFiles.length === 0) return;

      // Single file: direct download, no progress needed
      if (selectedFiles.length === 1) {
        const f = selectedFiles[0];
        const url = `/api/file/${f.fileId}?download=true&name=${encodeURIComponent(f.name)}`;
        const a = document.createElement("a");
        a.href = url;
        a.download = f.name.endsWith(".pdf") ? f.name : `${f.name}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Phase 1: Pre-fetch files with progress via SSE
      setDownloadProgress({ phase: "fetching", fetched: 0, total: selectedFiles.length, currentFile: "" });

      const progressBody = JSON.stringify({ files: selectedFiles });
      const progressResp = await fetch("/api/documents/download-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: progressBody,
      });

      if (!progressResp.ok) {
        throw new Error("Failed to start download preparation");
      }

      const reader = progressResp.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.done) break;
              setDownloadProgress({
                phase: "fetching",
                fetched: evt.fetched ?? 0,
                total: evt.total ?? selectedFiles.length,
                currentFile: evt.currentFile ?? "",
              });
            } catch { /* ignore malformed SSE lines */ }
          }
        }
      }

      // Phase 2: Download the zip (files are now cached on server)
      setDownloadProgress((prev) => ({ ...prev, phase: "zipping", currentFile: "" }));

      const resp = await fetch("/api/documents/download-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: selectedFiles }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error || `Download failed (${resp.status})`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${committeeSlug}-documents.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setIsDownloading(false);
      setDownloadProgress({ phase: "idle", fetched: 0, total: 0, currentFile: "" });
    }
  }, [selected, allMeetings, selectedCount, committeeSlug]);

  const lastPage = pages?.[pages.length - 1];
  const hasMore = lastPage ? size < lastPage.totalPages : false;
  const totalMeetingsCount = lastPage?.totalMeetings;

  const loadMore = useCallback(() => {
    setSize((s) => s + 1);
  }, [setSize]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Browse & Download Documents
      </button>
    );
  }

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSelected(new Set());
                setTypeFilter(null);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Committee Documents</h3>
              {pages && pages.length > 0 && (
                <p className="text-xs text-gray-500">
                  {allFiles.length} document{allFiles.length !== 1 ? "s" : ""} across{" "}
                  {meetingsWithFiles} meeting{meetingsWithFiles !== 1 ? "s" : ""}
                  {totalMeetingsCount != null && totalMeetingsCount > allMeetings.length && (
                    <span> ({allMeetings.length} of {totalMeetingsCount} loaded)</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={selectedCount === 0 || isDownloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {downloadProgress.phase === "fetching"
                    ? `Fetching ${downloadProgress.fetched}/${downloadProgress.total}`
                    : downloadProgress.phase === "zipping"
                    ? "Building zip..."
                    : "Preparing..."}
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </>
              )}
            </button>
          </div>
        </div>

        {downloadError && (
          <p className="mt-2 text-xs text-red-600">{downloadError}</p>
        )}

        {isDownloading && downloadProgress.phase === "fetching" && downloadProgress.total > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">
                Fetching {downloadProgress.fetched} of {downloadProgress.total} documents...
              </span>
              <span className="text-xs font-medium text-gray-700">
                {Math.round((downloadProgress.fetched / downloadProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(downloadProgress.fetched / downloadProgress.total) * 100}%` }}
              />
            </div>
            {downloadProgress.currentFile && (
              <p className="mt-1 text-[10px] text-gray-400 truncate">{downloadProgress.currentFile}</p>
            )}
          </div>
        )}

        {isDownloading && downloadProgress.phase === "zipping" && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs text-gray-600">Building zip file...</span>
            </div>
          </div>
        )}

        {/* Type filter + Select All */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleSelected && allFiles.length > 0}
              onChange={selectAll}
              className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-medium text-gray-600">Select all</span>
          </label>

          <span className="text-gray-300 text-xs">|</span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTypeFilter(null)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                typeFilter === null
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All types
            </button>
            {fileTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  typeFilter === type
                    ? "bg-gray-900 text-white"
                    : getFileTypeBadgeColor(type)
                } hover:opacity-80`}
              >
                {type}
              </button>
            ))}
          </div>

          {fileTypes.length > 0 && (
            <>
              <span className="text-gray-300 text-xs">|</span>
              <div className="flex items-center gap-1 flex-wrap">
                {fileTypes.map((type) => {
                  const typeFiles = allFiles.filter(({ file }) => file.type === type);
                  const allOfTypeSelected = typeFiles.length > 0 && typeFiles.every(({ file }) => selected.has(fileKey(file.fileId)));
                  return (
                    <button
                      key={`select-${type}`}
                      type="button"
                      onClick={() => selectByType(type)}
                      className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                        allOfTypeSelected
                          ? "bg-indigo-100 text-indigo-700"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                      title={allOfTypeSelected ? `Deselect all ${type}` : `Select all ${type}`}
                    >
                      {allOfTypeSelected ? "✓" : "☐"} {type}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading && allMeetings.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-6 h-6 animate-spin mx-auto text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">Loading documents...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">
            Failed to load documents. Please try again.
          </div>
        ) : allMeetings.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No documents found for this committee.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {allMeetings.map((meeting) => {
              const visibleFiles = meeting.files.filter(
                (f) => !typeFilter || f.type === typeFilter
              );
              const hasFiles = visibleFiles.length > 0;

              const isExpanded = expandedMeetings.has(meeting.eventId);
              const meetingAllSelected = hasFiles && visibleFiles.every((f) =>
                selected.has(fileKey(f.fileId))
              );
              const meetingSomeSelected = hasFiles && visibleFiles.some((f) =>
                selected.has(fileKey(f.fileId))
              );

              return (
                <div key={meeting.eventId}>
                  {/* Meeting header row */}
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 select-none ${
                      hasFiles
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "opacity-50"
                    }`}
                    onClick={hasFiles ? () => toggleMeetingExpanded(meeting.eventId) : undefined}
                  >
                    {hasFiles ? (
                      <input
                        type="checkbox"
                        checked={meetingAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = meetingSomeSelected && !meetingAllSelected;
                        }}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleMeeting(meeting);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                      />
                    ) : (
                      <span className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">
                        {meeting.eventName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(meeting.startDateTime)}
                        {hasFiles
                          ? <> &middot; {visibleFiles.length} doc{visibleFiles.length !== 1 ? "s" : ""}</>
                          : <> &middot; No documents published</>
                        }
                      </span>
                    </div>
                  </div>

                  {/* Expanded file list */}
                  {isExpanded && hasFiles && (
                    <div className="bg-gray-50/50 border-t border-gray-100">
                      {visibleFiles.map((file) => {
                        const key = fileKey(file.fileId);
                        const isFileSelected = selected.has(key);
                        const downloadUrl = `/api/file/${file.fileId}?download=true&name=${encodeURIComponent(file.name)}`;
                        const sizeStr = formatFileSize(file.fileSize);

                        return (
                          <label
                            key={file.fileId}
                            className={`flex items-center gap-3 px-4 pl-12 py-2 cursor-pointer hover:bg-gray-100/80 transition-colors ${
                              isFileSelected ? "bg-indigo-50/50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isFileSelected}
                              onChange={() => toggleFile(file.fileId)}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-800 truncate block">
                                {file.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getFileTypeBadgeColor(
                                    file.type
                                  )}`}
                                >
                                  {file.type}
                                </span>
                                {sizeStr && (
                                  <span className="text-[10px] text-gray-400">{sizeStr}</span>
                                )}
                                {file.pageCount != null && (
                                  <span className="text-[10px] text-gray-400">
                                    {file.pageCount} pg{file.pageCount !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            <a
                              href={downloadUrl}
                              title="Download"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors flex-shrink-0"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </a>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with load more */}
      {(hasMore || allMeetings.length > 0) && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center space-y-2">
          <p className="text-xs text-gray-500">
            Showing {allMeetings.length} of {totalMeetingsCount ?? "..."} meetings
          </p>
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isValidating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </>
              ) : (
                "Load more meetings"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
