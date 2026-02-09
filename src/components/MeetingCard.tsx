import Link from "next/link";
import { CivicEvent } from "@/lib/types";
import { formatEventDate, formatEventTime } from "@/lib/utils";

interface MeetingCardProps {
  event: CivicEvent;
}

export function MeetingCard({ event }: MeetingCardProps) {
  const hasFiles = (event.fileCount ?? 0) > 0;
  const isFuture = new Date(event.startDateTime) > new Date();

  return (
    <Link
      href={`/meeting/${event.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-gray-900">
            {event.eventName}
          </h3>

          {/* Date and time */}
          <p className="text-sm text-gray-500 mt-1">
            {formatEventDate(event.startDateTime)} at{" "}
            {formatEventTime(event.startDateTime)}
          </p>

          {/* Location */}
          {event.venueName && (
            <p className="text-sm text-gray-400 mt-1 truncate">
              {event.venueName}
            </p>
          )}
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {/* File count badge - always show with icon */}
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
            hasFiles 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-gray-100 text-gray-500'
          }`}>
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
            {event.fileCount || 0}
          </span>

          {/* Upcoming indicator for future meetings */}
          {isFuture && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded whitespace-nowrap">
              Upcoming
            </span>
          )}

          {/* Has documents indicator - only show when files are actually available */}
          {hasFiles && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded whitespace-nowrap">
              Has Agenda
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
