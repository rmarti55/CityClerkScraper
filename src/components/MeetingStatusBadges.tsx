import type { CivicEvent } from "@/lib/types";
import { isEventCanceled, formatEventTime } from "@/lib/utils";
import { getMeetingTimeStatus, isZoomLinkRelevant } from "@/lib/datetime";
import { PaperclipIcon, YouTubeIcon, DocumentIcon, VideoCameraIcon } from "./icons";

export interface MediaFlags {
  hasVideo?: boolean;
  hasTranscript?: boolean;
  hasZoomLink?: boolean;
}

interface MeetingStatusBadgesProps {
  event: CivicEvent;
  /** For card variant: show attachment count. Omit or 0 for detail. */
  fileCount?: number;
  variant: "card" | "detail";
  /** Optional class name for the container (e.g. for layout). */
  className?: string;
  /** Optional media availability flags for compact icons on cards. */
  media?: MediaFlags;
}

/**
 * Single source of truth for meeting status badges.
 * Card: file count, Canceled, Happening Now / Today / Upcoming.
 * Detail: Canceled, Happening Now / Today / Upcoming (attachment count is shown in Attachments section).
 */
export function MeetingStatusBadges({
  event,
  fileCount = 0,
  variant,
  className = "",
  media,
}: MeetingStatusBadgesProps) {
  const hasFiles = fileCount > 0;
  const isCanceled = isEventCanceled(event);
  const status = getMeetingTimeStatus(event.startDateTime);

  const badgePadding = variant === "detail" ? "py-1" : "py-0.5";
  const rounded = variant === "detail" ? "rounded" : "rounded whitespace-nowrap";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {variant === "card" && (
        <span
          className={`inline-flex items-center gap-1 px-2 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap ${
            hasFiles ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          <PaperclipIcon className="w-3 h-3" />
          {fileCount}
        </span>
      )}
      {variant === "card" && media?.hasVideo && (
        <span
          className={`inline-flex items-center gap-1 px-2.5 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap bg-red-50 text-red-600`}
          title="Video recording available"
        >
          <YouTubeIcon className="w-3.5 h-3.5" />
        </span>
      )}
      {variant === "card" && media?.hasTranscript && (
        <span
          className={`inline-flex items-center gap-1 px-2.5 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap bg-purple-50 text-purple-600`}
          title="AI transcript available"
        >
          <DocumentIcon className="w-3.5 h-3.5" />
        </span>
      )}
      {variant === "card" && media?.hasZoomLink && isZoomLinkRelevant(event.startDateTime) && (
        <span
          className={`inline-flex items-center gap-1 px-2.5 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap bg-blue-50 text-blue-600`}
          title="Virtual meeting link available"
        >
          <VideoCameraIcon className="w-3.5 h-3.5" />
        </span>
      )}
      {isCanceled && (
        <span
          className={`px-2 ${badgePadding} text-xs font-medium bg-red-100 text-red-700 ${rounded}`}
        >
          Canceled
        </span>
      )}
      {!isCanceled && status === "happening-now" && (
        <span
          className={`inline-flex items-center gap-1.5 px-2 ${badgePadding} text-xs font-medium bg-emerald-200 text-emerald-800 ${rounded}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Happening Now
        </span>
      )}
      {!isCanceled && status === "today" && (
        <span
          className={`px-2 ${badgePadding} text-xs font-medium bg-green-100 text-green-700 ${rounded}`}
        >
          Today at {formatEventTime(event.startDateTime)}
        </span>
      )}
      {!isCanceled && status === "upcoming" && (
        <span
          className={`px-2 ${badgePadding} text-xs font-medium bg-amber-100 text-amber-700 ${rounded}`}
        >
          Upcoming
        </span>
      )}
    </div>
  );
}
