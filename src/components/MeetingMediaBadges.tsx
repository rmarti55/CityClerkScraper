"use client";

import useSWR from "swr";
import { isZoomLinkRelevant } from "@/lib/datetime";
import { YouTubeIcon, DocumentIcon, VideoCameraIcon } from "./icons";

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
export function MeetingMediaBadges({ eventId, startDateTime }: { eventId: number; startDateTime: string }) {
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
  const rawZoomLink = zoomData?.zoomLink && zoomData.zoomLink !== "none" ? zoomData.zoomLink : null;
  const zoomLink = rawZoomLink && isZoomLinkRelevant(startDateTime) ? rawZoomLink : null;

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
          <YouTubeIcon className="w-3.5 h-3.5" />
          Video Recording
        </a>
      )}
      {hasTranscript && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <DocumentIcon className="w-3.5 h-3.5" />
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
          <VideoCameraIcon className="w-3.5 h-3.5" />
          Virtual Meeting
        </a>
      )}
    </div>
  );
}
