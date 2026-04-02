import type { Metadata } from "next";
import { Suspense } from "react";
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
import { formatEventLocation } from "@/lib/utils";
import { FileMetadata } from "@/components/FileMetadata";
import { EventLocation } from "@/components/EventLocation";
import { MeetingStatusBadges } from "@/components/MeetingStatusBadges";
import { MeetingRefreshButton } from "@/components/MeetingRefreshButton";
import { collectItemsWithAttachments } from "@/lib/agenda-items";
import { cacheAgendaItems } from "@/lib/civicclerk/agenda-cache";
import { AgendaSummary } from "@/components/AgendaSummary";
import { AgendaItemsList } from "@/components/AgendaItemsList";
import { ViewDocumentButton } from "@/components/ViewDocumentButton";
import { DocumentCardWrapper } from "@/components/DocumentCardWrapper";
import { DocumentGrid } from "@/components/DocumentGrid";
import { SaveDocumentButton } from "@/components/SaveDocumentButton";
import { DocumentViewerProvider } from "@/context/DocumentViewerContext";
import { MeetingDetailLayout } from "@/components/MeetingDetailLayout";
import { MeetingTranscript } from "@/components/MeetingTranscript";
import { MeetingMediaBadges } from "@/components/MeetingMediaBadges";
import { LiveStreamEmbed } from "@/components/LiveStreamEmbed";
import { SITE_NAME } from "@/lib/branding";
import { DocumentIcon, VideoCameraIcon } from "@/components/icons";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; category?: string; from?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) return { title: SITE_NAME };
  const event = await getEventById(eventId);
  return { title: event ? `${event.eventName} | ${SITE_NAME}` : SITE_NAME };
}

function FileIcon({ fileType }: { fileType: string }) {
  const type = fileType.toLowerCase();
  const isPdf = type.includes("agenda") || type.includes("minutes") || type.includes("packet");
  const isVideo = type.includes("video");

  if (isPdf) {
    return (
      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path d="M8 12h8v2H8zM8 15h8v2H8z" />
      </svg>
    );
  }

  if (isVideo) {
    return <VideoCameraIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />;
  }

  return <DocumentIcon className="w-5 h-5 text-gray-900 flex-shrink-0" />;
}

function getFileTypeBadgeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("agenda") && t.includes("packet")) return "bg-blue-100 text-blue-700";
  if (t.includes("agenda")) return "bg-green-100 text-green-700";
  if (t.includes("minutes")) return "bg-purple-100 text-purple-700";
  if (t.includes("video")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-800";
}

function FileCard({ file, meetingId }: { file: CivicFile; meetingId: number }) {
  const viewUrl = `/api/file/${file.fileId}`;
  const downloadUrl = `/api/file/${file.fileId}?download=true&name=${encodeURIComponent(file.name)}`;
  const chatUrl = `/meeting/${meetingId}/file/${file.fileId}?name=${encodeURIComponent(file.name)}`;

  return (
    <DocumentCardWrapper pdfUrl={viewUrl}>
      <div className="flex items-center gap-3">
        <FileIcon fileType={file.type} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-[15px] leading-tight truncate">{file.name}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded whitespace-nowrap ${getFileTypeBadgeColor(file.type)}`}>
              {file.type}
            </span>
            {file.publishOn && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Posted {new Date(file.publishOn).toLocaleDateString("en-US", { timeZone: "America/Denver" })}
              </span>
            )}
            <FileMetadata fileId={file.fileId} />
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <SaveDocumentButton
            documentType="file"
            documentId={file.fileId}
            eventId={meetingId}
            documentName={file.name}
            documentCategory={file.type}
          />
          <Link
            href={chatUrl}
            title="Chat with AI"
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>
          <ViewDocumentButton url={viewUrl} title={file.name} />
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

async function MeetingContent({ eventId, event }: { eventId: number; event: NonNullable<Awaited<ReturnType<typeof getEventById>>> }) {
  const meetingDetails = event.agendaId != null
    ? await getMeetingDetails(event.agendaId).catch(() => null)
    : null;

  if (meetingDetails?.items?.length && event.agendaId != null) {
    cacheAgendaItems(eventId, event.agendaId, meetingDetails.items).catch(() => {});
  }

  const files = await getEventFiles(eventId, { event, meetingDetails });

  const agendaId = event.agendaId;
  const itemsWithAttachments = meetingDetails
    ? collectItemsWithAttachments(meetingDetails.items ?? [])
    : [];

  const location = formatEventLocation(event);
  const formattedDate = formatEventDate(event.startDateTime);
  const formattedTime = formatEventTime(event.startDateTime);

  const meetingInfo = [
    `From: ${event.eventName}`,
    `${formattedDate} at ${formattedTime}`,
    location,
  ].filter(Boolean).join("\n");

  return (
    <>
      {files.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Meeting Documents ({files.length})
          </h2>
          <DocumentGrid count={files.length}>
            {files.map((file) => (
              <FileCard key={file.fileId} file={file} meetingId={eventId} />
            ))}
          </DocumentGrid>
        </div>
      )}

      {itemsWithAttachments.length > 0 && agendaId != null ? (
        <div>
          <AgendaSummary eventId={eventId} />
          <AgendaItemsList
            items={itemsWithAttachments}
            agendaId={agendaId}
            eventId={eventId}
            meetingInfo={meetingInfo}
          />
        </div>
      ) : itemsWithAttachments.length === 0 && files.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <svg
            className="w-12 h-12 text-gray-900 mx-auto mb-4"
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
          <p className="text-gray-600">No documents available</p>
        </div>
      ) : null}
    </>
  );
}

function MeetingContentSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-5 w-44 bg-gray-200 rounded mb-2" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-gray-200 rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-2/5" />
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-7 h-7 bg-gray-200 rounded" />
                <div className="w-7 h-7 bg-gray-200 rounded" />
                <div className="w-7 h-7 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MeetingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  await searchParams;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    notFound();
  }

  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  const location = formatEventLocation(event);
  const formattedDate = formatEventDate(event.startDateTime);
  const formattedTime = formatEventTime(event.startDateTime);

  return (
    <DocumentViewerProvider>
      <MeetingDetailLayout>
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {event.eventName}
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Date:</span>{" "}
              <span className="text-gray-900">{formattedDate}</span>
            </div>
            <div>
              <span className="text-gray-600">Time:</span>{" "}
              <span className="text-gray-900">{formattedTime}</span>
            </div>
            {location && (
              <div className="sm:col-span-2">
                <span className="text-gray-600">Location:</span>
                <div className="mt-0.5">
                  <EventLocation
                    event={event}
                    iconClassName="w-4 h-4 text-gray-900 shrink-0 mt-0.5"
                    className="text-gray-900"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <MeetingStatusBadges event={event} variant="detail" />
          </div>

          <MeetingMediaBadges eventId={eventId} startDateTime={event.startDateTime} />

          {event.eventDescription && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-800 text-sm whitespace-pre-wrap">
                {event.eventDescription}
              </p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100">
            <MeetingRefreshButton eventId={event.id} cachedAt={event.cachedAt} />
          </div>
        </div>

        <LiveStreamEmbed eventId={eventId} startDateTime={event.startDateTime} />

        <MeetingTranscript eventId={eventId} />

        <Suspense fallback={<MeetingContentSkeleton />}>
          <MeetingContent eventId={eventId} event={event} />
        </Suspense>
      </MeetingDetailLayout>
    </DocumentViewerProvider>
  );
}
