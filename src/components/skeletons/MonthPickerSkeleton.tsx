import { Skeleton } from "./Skeleton";

/**
 * Skeleton that matches the MonthPicker component layout.
 * Shows placeholder for navigation arrows, month/year selects, and today button.
 */
export function MonthPickerSkeleton() {
  return (
    <div
      className="flex items-center justify-between gap-4 mb-6"
      aria-label="Loading date picker..."
    >
      <div className="flex items-center gap-2">
        {/* Previous month button */}
        <Skeleton className="w-9 h-9 rounded-lg" />

        {/* Month/Year selects */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>

        {/* Next month button */}
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>

      {/* Today button */}
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  );
}
