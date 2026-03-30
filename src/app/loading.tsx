import { Skeleton } from "@/components/skeletons/Skeleton";
import { MeetingListSkeleton } from "@/components/skeletons/MeetingCardSkeleton";

/**
 * Loading state for the home page route.
 * Displays skeleton placeholders matching the page layout while data loads.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 lg:max-w-none lg:px-12">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-56" />
        </div>

        {/* Meeting list skeleton */}
        <MeetingListSkeleton count={5} />
      </div>
    </main>
  );
}
