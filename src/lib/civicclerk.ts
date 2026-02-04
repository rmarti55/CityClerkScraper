import { db, events, files } from './db';
import { eq, gte, lt, and } from 'drizzle-orm';

const API_BASE = "https://santafenm.api.civicclerk.com/v1";

// Cache duration in milliseconds (1 hour)
const CACHE_DURATION_MS = 60 * 60 * 1000;

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
 * Check if cached data is still fresh
 */
function isCacheFresh(cachedAt: Date | null): boolean {
  if (!cachedAt) return false;
  return Date.now() - cachedAt.getTime() < CACHE_DURATION_MS;
}

/**
 * Fetch events for a given date range from API (handles pagination)
 * Note: CivicClerk API has a hard limit of 15 results per page
 */
async function fetchEventsFromAPI(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  const filter = `startDateTime ge ${startDate} and startDateTime lt ${endDate}`;
  const allEvents: CivicEvent[] = [];
  let skip = 0;

  while (true) {
    const url = `${API_BASE}/Events?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime asc&$count=true&$skip=${skip}`;

    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const data: EventsResponse = await response.json();
    
    // No more results - we've fetched everything
    if (data.value.length === 0) {
      break;
    }

    allEvents.push(...data.value);
    skip += data.value.length;
  }

  return allEvents;
}

/**
 * Fetch events for a given date range (with database caching)
 */
export async function getEvents(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  try {
    // Check cache first
    const cacheThreshold = new Date(Date.now() - CACHE_DURATION_MS);
    const cached = await db.select().from(events)
      .where(
        and(
          gte(events.startDateTime, new Date(startDate)),
          lt(events.startDateTime, new Date(endDate)),
          gte(events.cachedAt, cacheThreshold)
        )
      )
      .orderBy(events.startDateTime);

    if (cached.length > 0) {
      // Return cached data, mapping to CivicEvent format
      return cached.map(e => ({
        id: e.id,
        eventName: e.eventName,
        eventDescription: e.eventDescription || '',
        eventDate: e.eventDate,
        startDateTime: e.startDateTime.toISOString(),
        agendaId: e.agendaId,
        agendaName: e.agendaName || '',
        categoryName: e.categoryName || '',
        isPublished: e.isPublished || '',
        venueName: e.venueName || undefined,
        venueAddress: e.venueAddress || undefined,
        venueCity: e.venueCity || undefined,
        venueState: e.venueState || undefined,
        venueZip: e.venueZip || undefined,
        fileCount: e.fileCount || 0,
      }));
    }
  } catch (error) {
    // If database is not available, fall back to API
    console.warn('Database cache unavailable, fetching from API:', error);
  }

  // Fetch fresh data from API
  return fetchEventsFromAPI(startDate, endDate);
}

/**
 * Fetch a single event by ID
 */
export async function getEventById(id: number): Promise<CivicEvent | null> {
  try {
    // Check cache first
    const cached = await db.select().from(events).where(eq(events.id, id)).limit(1);
    
    if (cached.length > 0 && isCacheFresh(cached[0].cachedAt)) {
      const e = cached[0];
      return {
        id: e.id,
        eventName: e.eventName,
        eventDescription: e.eventDescription || '',
        eventDate: e.eventDate,
        startDateTime: e.startDateTime.toISOString(),
        agendaId: e.agendaId,
        agendaName: e.agendaName || '',
        categoryName: e.categoryName || '',
        isPublished: e.isPublished || '',
        venueName: e.venueName || undefined,
        venueAddress: e.venueAddress || undefined,
        venueCity: e.venueCity || undefined,
        venueState: e.venueState || undefined,
        venueZip: e.venueZip || undefined,
        fileCount: e.fileCount || 0,
      };
    }
  } catch (error) {
    console.warn('Database cache unavailable:', error);
  }

  // Fetch from API
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
  try {
    // Check file cache first
    const cached = await db.select().from(files).where(eq(files.eventId, eventId));
    
    if (cached.length > 0 && isCacheFresh(cached[0].cachedAt)) {
      return cached.map(f => ({
        fileId: f.id,
        name: f.name,
        type: f.type,
        url: f.url,
        publishOn: f.publishOn || '',
        fileType: f.fileType || 0,
      }));
    }
  } catch (error) {
    console.warn('Database cache unavailable:', error);
  }

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

  const publishedFiles = meeting.publishedFiles || [];

  // Cache the files
  try {
    if (publishedFiles.length > 0) {
      await db.insert(files)
        .values(publishedFiles.map(f => ({
          id: f.fileId,
          eventId: eventId,
          name: f.name,
          type: f.type,
          url: f.url,
          publishOn: f.publishOn,
          fileType: f.fileType,
          cachedAt: new Date(),
        })))
        .onConflictDoUpdate({
          target: files.id,
          set: {
            name: files.name,
            type: files.type,
            url: files.url,
            cachedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.warn('Failed to cache files:', error);
  }

  return publishedFiles;
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
 * Get events with file counts for a month (with database caching)
 */
export async function getEventsWithFileCounts(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  try {
    // Check cache first - if we have fresh cached events with file counts, use them
    const cacheThreshold = new Date(Date.now() - CACHE_DURATION_MS);
    const cached = await db.select().from(events)
      .where(
        and(
          gte(events.startDateTime, new Date(startDate)),
          lt(events.startDateTime, new Date(endDate)),
          gte(events.cachedAt, cacheThreshold)
        )
      )
      .orderBy(events.startDateTime);

    if (cached.length > 0) {
      return cached.map(e => ({
        id: e.id,
        eventName: e.eventName,
        eventDescription: e.eventDescription || '',
        eventDate: e.eventDate,
        startDateTime: e.startDateTime.toISOString(),
        agendaId: e.agendaId,
        agendaName: e.agendaName || '',
        categoryName: e.categoryName || '',
        isPublished: e.isPublished || '',
        venueName: e.venueName || undefined,
        venueAddress: e.venueAddress || undefined,
        venueCity: e.venueCity || undefined,
        venueState: e.venueState || undefined,
        venueZip: e.venueZip || undefined,
        fileCount: e.fileCount || 0,
      }));
    }
  } catch (error) {
    console.warn('Database cache unavailable, fetching from API:', error);
  }

  // Fetch fresh data from API
  const fetchedEvents = await fetchEventsFromAPI(startDate, endDate);

  // Fetch file counts in parallel (batch of 5 to be safe)
  const batchSize = 5;
  const eventsWithCounts: CivicEvent[] = [];

  for (let i = 0; i < fetchedEvents.length; i += batchSize) {
    const batch = fetchedEvents.slice(i, i + batchSize);
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

  // Cache the events with file counts
  try {
    if (eventsWithCounts.length > 0) {
      await db.insert(events)
        .values(eventsWithCounts.map(e => ({
          id: e.id,
          eventName: e.eventName,
          eventDescription: e.eventDescription,
          eventDate: e.eventDate,
          startDateTime: new Date(e.startDateTime),
          agendaId: e.agendaId,
          agendaName: e.agendaName,
          categoryName: e.categoryName,
          isPublished: e.isPublished,
          venueName: e.venueName,
          venueAddress: e.venueAddress,
          venueCity: e.venueCity,
          venueState: e.venueState,
          venueZip: e.venueZip,
          fileCount: e.fileCount || 0,
          cachedAt: new Date(),
        })))
        .onConflictDoUpdate({
          target: events.id,
          set: {
            eventName: events.eventName,
            eventDescription: events.eventDescription,
            agendaId: events.agendaId,
            agendaName: events.agendaName,
            categoryName: events.categoryName,
            fileCount: events.fileCount,
            cachedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.warn('Failed to cache events:', error);
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
