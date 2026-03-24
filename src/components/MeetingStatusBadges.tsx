import type { CivicEvent } from "@/lib/types";
import { isEventCanceled, formatEventTime } from "@/lib/utils";
import { getMeetingTimeStatus } from "@/lib/datetime";

const FILE_ICON = (
  <svg
    className="w-3 h-3"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
    />
  </svg>
);

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
          {FILE_ICON}
          {fileCount}
        </span>
      )}
      {variant === "card" && media?.hasVideo && (
        <span
          className={`inline-flex items-center gap-1 px-2 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap bg-red-50 text-red-600`}
          title="Video recording available"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
          </svg>
        </span>
      )}
      {variant === "card" && media?.hasTranscript && (
        <span
          className={`inline-flex items-center gap-1 px-2 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap bg-purple-50 text-purple-600`}
          title="AI transcript available"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </span>
      )}
      {variant === "card" && media?.hasZoomLink && (
        <span
          className={`inline-flex items-center gap-1 px-2 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap bg-blue-50 text-blue-600`}
          title="Virtual meeting link available"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
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
