import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEventById,
  getEventFiles,
  getMeetingDetails,
  formatEventDate,
  formatEventTime,
  CivicFile,
} from "@/lib/civicclerk";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

function FileIcon({ fileType }: { fileType: string }) {
  const type = fileType.toLowerCase();
  const isPdf = type.includes("agenda") || type.includes("minutes") || type.includes("packet");
  const isVideo = type.includes("video");

  if (isPdf) {
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path d="M8 12h8v2H8zM8 15h8v2H8z" />
      </svg>
    );
  }

  if (isVideo) {
    return (
      <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }

  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

function FileCard({ file }: { file: CivicFile }) {
  // Always use the API proxy route to properly serve the file
  const viewUrl = `/api/file/${file.fileId}`;
  const downloadUrl = `/api/file/${file.fileId}?download=true`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-4">
        <FileIcon fileType={file.type} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900">{file.name}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getFileTypeBadgeColor(file.type)}`}>
              {file.type}
            </span>
            {file.publishOn && (
              <span className="text-xs text-gray-400">
                Published {new Date(file.publishOn).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            View
          </a>
          <a
            href={downloadUrl}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function MeetingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { q: searchQuery } = await searchParams;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    notFound();
  }

  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  // Get files via the meeting/agenda endpoint
  let files: CivicFile[] = [];
  if (event.agendaId) {
    const meeting = await getMeetingDetails(event.agendaId);
    files = meeting?.publishedFiles || [];
  }

  // Build location string
  const location = [event.venueName, event.venueAddress, event.venueCity]
    .filter(Boolean)
    .join(", ");

  // Build back link with search query preserved
  const backHref = searchQuery ? `/?q=${encodeURIComponent(searchQuery)}` : "/";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href={backHref}
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
                <span className="text-gray-500">Location:</span>{" "}
                <span className="text-gray-900">{location}</span>
              </div>
            )}
          </div>

          {/* Status badges */}
          <div className="flex gap-2 mt-4">
            {event.agendaId && (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                Has Agenda
              </span>
            )}
            {event.isPublished === "Published" && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                Published
              </span>
            )}
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
                <FileCard key={file.fileId} file={file} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
