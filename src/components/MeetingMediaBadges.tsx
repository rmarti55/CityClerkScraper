"use client";

import useSWR from "swr";

interface TranscriptData {
  hasTranscript: boolean;
  video?: {
    youtubeVideoId: string;
    title: string;
  };
  transcript?: {
    status: string;
  } | null;
}

interface ZoomData {
  zoomLink: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Media availability pills for the meeting detail header.
 * Shows Video / AI Transcript / Virtual Meeting indicators with links.
 */
export function MeetingMediaBadges({ eventId }: { eventId: number }) {
  const { data: transcriptData } = useSWR<TranscriptData>(
    `/api/meeting/${eventId}/transcript`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const { data: zoomData } = useSWR<ZoomData>(
    `/api/meeting/${eventId}/zoom-link`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const hasVideo = !!transcriptData?.video?.youtubeVideoId;
  const hasTranscript = transcriptData?.transcript?.status === "completed";
  const zoomLink = zoomData?.zoomLink && zoomData.zoomLink !== "none" ? zoomData.zoomLink : null;

  if (!hasVideo && !hasTranscript && !zoomLink) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      {hasVideo && (
        <a
          href={`https://www.youtube.com/watch?v=${transcriptData!.video!.youtubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
          </svg>
          Video Recording
        </a>
      )}
      {hasTranscript && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          AI Transcript
        </span>
      )}
      {zoomLink && (
        <a
          href={zoomLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Virtual Meeting
        </a>
      )}
    </div>
  );
}
