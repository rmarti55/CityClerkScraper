import { Skeleton, SkeletonBadge } from "./Skeleton";

/**
 * Skeleton that matches the MeetingCard component layout.
 * Shows placeholder for category, title, date/time, venue, and badges.
 */
export function MeetingCardSkeleton() {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4"
      aria-label="Loading meeting..."
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Category placeholder */}
          <Skeleton className="h-4 w-1/4" />

          {/* Title placeholder */}
          <Skeleton className="h-5 w-3/4" />

          {/* Date and time placeholder */}
          <Skeleton className="h-4 w-1/2" />

          {/* Venue placeholder */}
          <Skeleton className="h-4 w-2/5" />
        </div>

        {/* Status badges placeholder */}
        <div className="flex flex-col items-end gap-2">
          <SkeletonBadge width="w-12" />
          <SkeletonBadge width="w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the stats bar above the meeting list.
 */
export function MeetingStatsBarSkeleton() {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Skeleton className="h-4 w-24" />
      <span className="text-gray-300">•</span>
      <Skeleton className="h-4 w-32" />
      <span className="text-gray-300">•</span>
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

/**
 * Skeleton for a date group header.
 */
export function MeetingDateHeaderSkeleton() {
  return <Skeleton className="h-4 w-40 mb-3" />;
}

/**
 * Skeleton for an entire meeting list with grouped dates.
 */
export function MeetingListSkeleton({ count = 5 }: { count?: number }) {
  // Simulate 2 date groups
  const firstGroupCount = Math.ceil(count / 2);
  const secondGroupCount = count - firstGroupCount;

  return (
    <div>
      <MeetingStatsBarSkeleton />

      <div className="space-y-8">
        {/* First date group */}
        <div>
          <MeetingDateHeaderSkeleton />
          <div className="space-y-3">
            {[...Array(firstGroupCount)].map((_, i) => (
              <MeetingCardSkeleton key={`group1-${i}`} />
            ))}
          </div>
        </div>

        {/* Second date group */}
        {secondGroupCount > 0 && (
          <div>
            <MeetingDateHeaderSkeleton />
            <div className="space-y-3">
              {[...Array(secondGroupCount)].map((_, i) => (
                <MeetingCardSkeleton key={`group2-${i}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
