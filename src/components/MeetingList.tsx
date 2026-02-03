import { CivicEvent } from "@/lib/civicclerk";
import { MeetingCard } from "./MeetingCard";

interface MeetingListProps {
  events: CivicEvent[];
}

// Group events by date
function groupEventsByDate(events: CivicEvent[]): Map<string, CivicEvent[]> {
  const groups = new Map<string, CivicEvent[]>();

  for (const event of events) {
    const dateKey = event.startDateTime.split("T")[0];
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, event]);
  }

  return groups;
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function MeetingList({ events }: MeetingListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 text-gray-300 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-500">No meetings scheduled this month</p>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events);
  const sortedDates = Array.from(groupedEvents.keys()).sort();

  // Calculate stats
  const totalFiles = events.reduce((sum, e) => sum + (e.fileCount || 0), 0);
  const withFiles = events.filter((e) => (e.fileCount || 0) > 0).length;

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
        <span>{events.length} meetings</span>
        <span className="text-gray-300">•</span>
        <span>{withFiles} with attachments</span>
        <span className="text-gray-300">•</span>
        <span>{totalFiles} total files</span>
      </div>

      {/* Grouped meetings */}
      <div className="space-y-8">
        {sortedDates.map((dateKey) => (
          <div key={dateKey}>
            <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">
              {formatDateHeader(dateKey)}
            </h2>
            <div className="space-y-3">
              {groupedEvents.get(dateKey)!.map((event) => (
                <MeetingCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
