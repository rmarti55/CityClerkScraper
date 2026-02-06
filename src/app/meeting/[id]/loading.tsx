import { MeetingDetailSkeleton } from "@/components/skeletons/MeetingDetailSkeleton";

/**
 * Loading state for the meeting detail page route.
 * Displays skeleton placeholders matching the page layout while data loads.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <MeetingDetailSkeleton />
      </div>
    </main>
  );
}
