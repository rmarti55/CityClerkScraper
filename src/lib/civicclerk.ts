const API_BASE = "https://santafenm.api.civicclerk.com/v1";

// Types based on actual CivicClerk API response structure
export interface CivicEvent {
  id: number;
  eventName: string;
  eventDescription: string;
  eventDate: string;
  startDateTime: string;
  agendaId: number | null;
  agendaName: string;
  categoryName: string;
  isPublished: string;
  // Location fields from venue
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  venueState?: string;
  venueZip?: string;
  // Computed fields
  fileCount?: number;
}

export interface CivicFile {
  fileId: number;
  name: string;
  type: string; // "Agenda", "Agenda Packet", "Minutes", etc.
  url: string;
  publishOn: string;
  fileType: number;
}

export interface MeetingDetails {
  id: number;
  agendaPacketIsPublish: boolean;
  agendaIsPublish: boolean;
  publishedFiles: CivicFile[];
  items: MeetingItem[];
}

export interface MeetingItem {
  id: number;
  agendaObjectItemName: string;
  agendaObjectItemOutlineNumber: string;
  agendaObjectItemDescription: string | null;
}

interface EventsResponse {
  "@odata.context": string;
  "@odata.count"?: number;
  value: CivicEvent[];
}

function getHeaders(): HeadersInit {
  return {
    Accept: "application/json",
  };
}

/**
 * Fetch events for a given date range
 */
export async function getEvents(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  const filter = `startDateTime ge ${startDate} and startDateTime lt ${endDate}`;
  const url = `${API_BASE}/Events?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime asc&$count=true`;

  const response = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  const data: EventsResponse = await response.json();
  return data.value;
}

/**
 * Fetch a single event by ID
 */
export async function getEventById(id: number): Promise<CivicEvent | null> {
  const url = `${API_BASE}/Events/${id}`;

  const response = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch event: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch meeting details (includes files) by agenda ID
 */
export async function getMeetingDetails(agendaId: number): Promise<MeetingDetails | null> {
  const url = `${API_BASE}/Meetings/${agendaId}`;

  const response = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch meeting: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch files for an event (via its agendaId)
 */
export async function getEventFiles(eventId: number): Promise<CivicFile[]> {
  // First get the event to find its agendaId
  const event = await getEventById(eventId);
  if (!event || !event.agendaId) {
    return [];
  }

  // Then get meeting details which contain the files
  const meeting = await getMeetingDetails(event.agendaId);
  if (!meeting) {
    return [];
  }

  return meeting.publishedFiles || [];
}

/**
 * Get the download URL for a file (for streaming/viewing)
 */
export function getFileDownloadUrl(fileId: number): string {
  return `${API_BASE}/Meetings/GetMeetingFileStream(fileId=${fileId},plainText=false)`;
}

/**
 * Get the direct file URL (alternative endpoint)
 */
export function getFileUrl(fileId: number): string {
  return `${API_BASE}/Meetings/GetMeetingFile(fileId=${fileId},plainText=false)`;
}

/**
 * Get events with file counts for a month
 */
export async function getEventsWithFileCounts(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  const events = await getEvents(startDate, endDate);

  // Fetch file counts in parallel (batch of 5 to be safe)
  const batchSize = 5;
  const eventsWithCounts: CivicEvent[] = [];

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (event) => {
        try {
          if (!event.agendaId) {
            return { ...event, fileCount: 0 };
          }
          const meeting = await getMeetingDetails(event.agendaId);
          const fileCount = meeting?.publishedFiles?.length || 0;
          return { ...event, fileCount };
        } catch {
          return { ...event, fileCount: 0 };
        }
      })
    );
    eventsWithCounts.push(...batchResults);
  }

  return eventsWithCounts;
}

/**
 * Helper to format date for display
 */
export function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Helper to format time for display
 */
export function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
