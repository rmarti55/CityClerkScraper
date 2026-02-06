import { Skeleton, SkeletonRect, SkeletonBadge } from "./Skeleton";

/**
 * Skeleton that matches the FileCard component layout.
 * Shows placeholder for file icon, name, type badge, date, and action buttons.
 */
export function FileCardSkeleton() {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4"
      aria-label="Loading file..."
    >
      <div className="flex items-start gap-4">
        {/* File icon placeholder */}
        <SkeletonRect width="w-8" height="h-8" />

        {/* File info */}
        <div className="flex-1 min-w-0">
          {/* File name */}
          <Skeleton className="h-5 w-3/4 mb-2" />
          
          {/* Type badge and date */}
          <div className="flex items-center gap-2">
            <SkeletonBadge width="w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a list of files.
 */
export function FileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <FileCardSkeleton key={i} />
      ))}
    </div>
  );
}
