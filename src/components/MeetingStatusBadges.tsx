import type { CivicEvent } from "@/lib/types";
import { isEventCanceled } from "@/lib/utils";

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

interface MeetingStatusBadgesProps {
  event: CivicEvent;
  /** For card variant: show attachment count. Omit or 0 for detail. */
  fileCount?: number;
  variant: "card" | "detail";
  /** Optional class name for the container (e.g. for layout). */
  className?: string;
}

/**
 * Single source of truth for meeting status badges.
 * Card: file count, Canceled, Upcoming.
 * Detail: Canceled, Upcoming when meeting is in the future (attachment count is shown in Attachments section).
 */
export function MeetingStatusBadges({
  event,
  fileCount = 0,
  variant,
  className = "",
}: MeetingStatusBadgesProps) {
  const hasFiles = fileCount > 0;
  const isCanceled = isEventCanceled(event);
  const isFuture = new Date(event.startDateTime) > new Date();

  const badgePadding = variant === "detail" ? "py-1" : "py-0.5";
  const rounded = variant === "detail" ? "rounded" : "rounded whitespace-nowrap";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {variant === "card" && (
        <span
          className={`inline-flex items-center gap-1 px-2 ${badgePadding} text-xs font-medium rounded-full whitespace-nowrap ${
            hasFiles ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {FILE_ICON}
          {fileCount}
        </span>
      )}
      {isCanceled && (
        <span
          className={`px-2 ${badgePadding} text-xs font-medium bg-red-100 text-red-700 ${rounded}`}
        >
          Canceled
        </span>
      )}
      {isFuture && (
        <span
          className={`px-2 ${badgePadding} text-xs font-medium bg-amber-100 text-amber-700 ${rounded}`}
        >
          Upcoming
        </span>
      )}
    </div>
  );
}
