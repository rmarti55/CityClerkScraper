const API_BASE = "https://santafenm.api.civicclerk.com/v1";

// Types based on CivicClerk API response structure
export interface CivicEvent {
  id: number;
  title: string;
  bodyId: number;
  bodyName: string;
  startDateTime: string;
  endDateTime: string | null;
  location: string | null;
  description: string | null;
  status: string;
  hasAgenda: boolean;
  hasMinutes: boolean;
  hasVideo: boolean;
  fileCount?: number;
}

export interface CivicFile {
  id: number;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  publishedDate: string;
  eventId: number;
}

export interface EventsResponse {
  "@odata.context": string;
  "@odata.count"?: number;
  value: CivicEvent[];
}

export interface FilesResponse {
  "@odata.context": string;
  value: CivicFile[];
}

function getHeaders(): HeadersInit {
  const token = process.env.CIVICCLERK_TOKEN;
  if (!token) {
    throw new Error("CIVICCLERK_TOKEN environment variable is not set");
  }
  return {
    Authorization: `Bearer ${token}`,
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
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Token expired - please refresh your CivicClerk token");
    }
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  const data: EventsResponse = await response.json();
  return data.value;
}

/**
 * Fetch a single event by ID
 */
export async function getEventById(id: number): Promise<CivicEvent | null> {
  const url = `${API_BASE}/Events(${id})`;

  const response = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    if (response.status === 401) {
      throw new Error("Token expired - please refresh your CivicClerk token");
    }
    throw new Error(`Failed to fetch event: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch files/attachments for an event
 */
export async function getEventFiles(eventId: number): Promise<CivicFile[]> {
  const url = `${API_BASE}/Events(${eventId})/Files`;

  const response = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Token expired - please refresh your CivicClerk token");
    }
    throw new Error(`Failed to fetch event files: ${response.status}`);
  }

  const data: FilesResponse = await response.json();
  return data.value;
}

/**
 * Get the download URL for a file
 */
export function getFileDownloadUrl(fileId: number): string {
  return `${API_BASE}/Files(${fileId})/$value`;
}

/**
 * Get events with file counts for a month (more efficient than fetching files for each)
 */
export async function getEventsWithFileCounts(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  // First get all events
  const events = await getEvents(startDate, endDate);

  // Fetch file counts in parallel (batch of 10 at a time to avoid rate limiting)
  const batchSize = 10;
  const eventsWithCounts: CivicEvent[] = [];

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (event) => {
        try {
          const files = await getEventFiles(event.id);
          return { ...event, fileCount: files.length };
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
