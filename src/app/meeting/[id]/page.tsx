import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEventById,
  getEventFiles,
  formatEventDate,
  formatEventTime,
  CivicFile,
} from "@/lib/civicclerk";
import { formatEventLocation } from "@/lib/utils";
import { FileMetadata } from "@/components/FileMetadata";
import { EventLocation } from "@/components/EventLocation";
import { MeetingStatusBadges } from "@/components/MeetingStatusBadges";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; category?: string; from?: string }>;
}

function FileIcon({ fileType }: { fileType: string }) {
  const type = fileType.toLowerCase();
  const isPdf = type.includes("agenda") || type.includes("minutes") || type.includes("packet");
  const isVideo = type.includes("video");

  if (isPdf) {
    return (
      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path d="M8 12h8v2H8zM8 15h8v2H8z" />
      </svg>
    );
  }

  if (isVideo) {
    return (
      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }

  return (
    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function getFileTypeBadgeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("agenda") && t.includes("packet")) return "bg-blue-100 text-blue-700";
  if (t.includes("agenda")) return "bg-green-100 text-green-700";
  if (t.includes("minutes")) return "bg-purple-100 text-purple-700";
  if (t.includes("video")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function FileCard({ file, meetingId }: { file: CivicFile; meetingId: number }) {
  const viewUrl = `/api/file/${file.fileId}`;
  const downloadUrl = `/api/file/${file.fileId}?download=true`;
  const chatUrl = `/meeting/${meetingId}/file/${file.fileId}?name=${encodeURIComponent(file.name)}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        {/* File info section - icon always inline with text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileIcon fileType={file.type} />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 leading-tight">{file.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${getFileTypeBadgeColor(file.type)}`}>
                {file.type}
              </span>
              {file.publishOn && (
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  Posted {new Date(file.publishOn).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="mt-1">
              <FileMetadata fileId={file.fileId} />
            </div>
          </div>
        </div>
        
        {/* Action buttons - full width on mobile, stacked on desktop */}
        <div className="flex gap-2 sm:flex-col sm:flex-shrink-0">
          <Link
            href={chatUrl}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </Link>
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </a>
          <a
            href={downloadUrl}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function MeetingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q: searchQuery, category: categoryId, from: fromPath } = await searchParams;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    notFound();
  }

  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  // Get files (upserts into DB so metadata API can cache size/page count)
  const files = await getEventFiles(eventId);

  const location = formatEventLocation(event);

  // Build back link: use "from" (e.g. governing-body) when present, else preserve home search/category
  const buildBackHref = () => {
    if (fromPath && typeof fromPath === "string" && fromPath.trim()) {
      const path = fromPath.trim().replace(/^\//, "");
      if (path) return `/${path}`;
    }
    const params = new URLSearchParams();
    if (searchQuery) {
      params.set("q", searchQuery);
    }
    if (categoryId) {
      params.set("category", categoryId);
    }
    const queryString = params.toString();
    return queryString ? `/?${queryString}` : "/";
  };
  const backHref = buildBackHref();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link - scroll={false} so home page restore can scroll to date (today) instead of being overwritten */}
        <Link
          href={backHref}
          scroll={false}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to meetings
        </Link>

        {/* Meeting header */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {event.eventName}
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Date:</span>{" "}
              <span className="text-gray-900">{formatEventDate(event.startDateTime)}</span>
            </div>
            <div>
              <span className="text-gray-500">Time:</span>{" "}
              <span className="text-gray-900">{formatEventTime(event.startDateTime)}</span>
            </div>
            {location && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Location:</span>
                <div className="mt-0.5">
                  <EventLocation
                    event={event}
                    iconClassName="w-4 h-4 text-gray-500 shrink-0 mt-0.5"
                    className="text-gray-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status badges */}
          <div className="mt-4">
            <MeetingStatusBadges event={event} variant="detail" />
          </div>

          {event.eventDescription && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-600 text-sm whitespace-pre-wrap">
                {event.eventDescription}
              </p>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Attachments ({files.length})
          </h2>

          {files.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <svg
                className="w-12 h-12 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-500">No attachments available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <FileCard key={file.fileId} file={file} meetingId={eventId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
