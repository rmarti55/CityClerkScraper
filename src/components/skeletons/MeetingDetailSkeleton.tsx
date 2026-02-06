import { Skeleton, SkeletonBadge } from "./Skeleton";
import { FileListSkeleton } from "./FileCardSkeleton";

/**
 * Skeleton for the meeting header card on the detail page.
 * Shows placeholder for category, title, date/time grid, location, and badges.
 */
export function MeetingHeaderSkeleton() {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 mb-6"
      aria-label="Loading meeting details..."
    >
      {/* Category */}
      <Skeleton className="h-4 w-32 mb-2" />

      {/* Title */}
      <Skeleton className="h-7 w-3/4 mb-4" />

      {/* Date/time/location grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 mt-4">
        <SkeletonBadge width="w-20" />
        <SkeletonBadge width="w-18" />
      </div>

      {/* Description placeholder */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Full skeleton for the meeting detail page.
 * Includes back link, header card, and attachments section.
 */
export function MeetingDetailSkeleton() {
  return (
    <div>
      {/* Back link */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Meeting header */}
      <MeetingHeaderSkeleton />

      {/* Attachments section */}
      <div>
        <Skeleton className="h-6 w-36 mb-4" />
        <FileListSkeleton count={3} />
      </div>
    </div>
  );
}
