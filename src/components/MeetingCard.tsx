import Link from "next/link";
import { CivicEvent, formatEventDate, formatEventTime } from "@/lib/civicclerk";

interface MeetingCardProps {
  event: CivicEvent;
}

export function MeetingCard({ event }: MeetingCardProps) {
  const hasContent = event.hasAgenda || event.hasMinutes || event.hasVideo || (event.fileCount && event.fileCount > 0);

  return (
    <Link
      href={`/meeting/${event.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Body name */}
          <p className="text-sm font-medium text-indigo-600 mb-1">
            {event.bodyName}
          </p>

          {/* Title */}
          <h3 className="font-semibold text-gray-900 truncate">
            {event.title}
          </h3>

          {/* Date and time */}
          <p className="text-sm text-gray-500 mt-1">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </p>

          {/* Location */}
          {event.location && (
            <p className="text-sm text-gray-400 mt-1 truncate">
              {event.location}
            </p>
          )}
        </div>

        {/* Status badges */}
        <div className="flex flex-col items-end gap-2">
          {/* File count badge */}
          {event.fileCount !== undefined && event.fileCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              {event.fileCount}
            </span>
          )}

          {/* Content indicators */}
          <div className="flex gap-1">
            {event.hasAgenda && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                Agenda
              </span>
            )}
            {event.hasMinutes && (
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                Minutes
              </span>
            )}
            {event.hasVideo && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                Video
              </span>
            )}
          </div>

          {/* Empty indicator */}
          {!hasContent && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">
              No files
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
