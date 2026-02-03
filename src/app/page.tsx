import { Suspense } from "react";
import { getEventsWithFileCounts } from "@/lib/civicclerk";
import { MonthPicker } from "@/components/MonthPicker";
import { MeetingList } from "@/components/MeetingList";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

function getDateRange(year: number, month: number) {
  const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;
  return { startDate, endDate };
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  const isTokenError = error.includes("Token expired") || error.includes("CIVICCLERK_TOKEN");

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-3">
        <svg
          className="w-6 h-6 text-red-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <h3 className="font-medium text-red-800">
            {isTokenError ? "Authentication Error" : "Failed to Load Meetings"}
          </h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          {isTokenError && (
            <p className="text-sm text-red-600 mt-2">
              Update your CIVICCLERK_TOKEN environment variable with a fresh
              token from the CivicClerk portal.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

async function MeetingsContent({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  try {
    const { startDate, endDate } = getDateRange(year, month);
    const events = await getEventsWithFileCounts(startDate, endDate);
    return <MeetingList events={events} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return <ErrorState error={message} />;
  }
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Santa Fe City Meetings
          </h1>
          <p className="text-gray-500 mt-1">
            Public meeting calendar and documents
          </p>
        </div>

        {/* Month picker */}
        <Suspense fallback={null}>
          <MonthPicker currentYear={year} currentMonth={month} />
        </Suspense>

        {/* Meeting list */}
        <Suspense fallback={<LoadingState />}>
          <MeetingsContent year={year} month={month} />
        </Suspense>
      </div>
    </main>
  );
}
