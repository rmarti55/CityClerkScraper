/**
 * Reusable loading skeleton for search result lists.
 *
 * `variant="card"` (default) renders bordered card-style placeholders used by
 * GlobalSearchResults, CategoryFilterResults, DocumentSearchResults, and TranscriptSearchResults.
 *
 * `variant="compact"` renders tighter rows used inside MobileSearchModal.
 */

interface SearchSkeletonProps {
  count?: number;
  variant?: "card" | "compact";
}

export function SearchSkeleton({ count = 3, variant = "card" }: SearchSkeletonProps) {
  if (variant === "compact") {
    return (
      <div className="px-4 py-4 space-y-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-48" />
        </div>
      ))}
    </div>
  );
}
