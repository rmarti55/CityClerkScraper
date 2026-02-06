import { db, events, files } from './db';
import { eq, gte, lt, and } from 'drizzle-orm';

// Re-export types for backward compatibility
export type { CivicEvent, CivicFile, MeetingDetails, MeetingItem } from './types';
import type { CivicEvent, CivicFile, MeetingDetails } from './types';

const API_BASE = "https://santafenm.api.civicclerk.com/v1";

// Cache duration constants
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Get cache duration based on event age
 * - Events > 30 days old: permanent (historical records don't change)
 * - Events 7-30 days old: 24 hours (minutes might still be added)
 * - Events < 7 days old or future: 1 hour (agenda updates possible)
 */
function getCacheDuration(eventDate: Date): number {
  const ageInDays = (Date.now() - eventDate.getTime()) / ONE_DAY_MS;
  
  if (ageInDays > 30) {
    return Infinity; // Permanent - historical record
  } else if (ageInDays > 7) {
    return ONE_DAY_MS; // 24 hours - minutes might still be added
  } else {
    return ONE_HOUR_MS; // 1 hour - recent/upcoming, agenda updates possible
  }
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
 * Check if cached data is still fresh based on event date
 * Uses age-based caching: older events have longer cache duration
 */
function isCacheFresh(cachedAt: Date | null, eventDate: Date): boolean {
  if (!cachedAt) return false;
  const cacheDuration = getCacheDuration(eventDate);
  if (cacheDuration === Infinity) return true; // Permanent cache for old events
  return Date.now() - cachedAt.getTime() < cacheDuration;
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
 * Helper to map cached event to CivicEvent format
 */
function mapCachedEvent(e: typeof events.$inferSelect): CivicEvent {
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

/**
 * Fetch events for a given date range (with database caching)
 */
export async function getEvents(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  let cachedEvents: (typeof events.$inferSelect)[] = [];
  
  try {
    // Check cache first - fetch all cached events for the date range
    cachedEvents = await db.select().from(events)
      .where(
        and(
          gte(events.startDateTime, new Date(startDate)),
          lt(events.startDateTime, new Date(endDate))
        )
      )
      .orderBy(events.startDateTime);

    // Check if ALL cached events are fresh based on their individual dates
    if (cachedEvents.length > 0) {
      const allFresh = cachedEvents.every(e => isCacheFresh(e.cachedAt, e.startDateTime));
      
      if (allFresh) {
        return cachedEvents.map(mapCachedEvent);
      }
    }
  } catch (error) {
    // If database is not available, fall back to API
    console.warn('Database cache unavailable, fetching from API:', error);
  }

  // Try to fetch fresh data from API
  try {
    return await fetchEventsFromAPI(startDate, endDate);
  } catch (apiError) {
    // API failed - fall back to stale cache if available
    console.warn('API unavailable, falling back to stale cache:', apiError);
    if (cachedEvents.length > 0) {
      console.log(`Serving ${cachedEvents.length} stale cached events`);
      return cachedEvents.map(mapCachedEvent);
    }
    throw apiError; // No cache available, re-throw
  }
}

/**
 * Fetch a single event by ID
 */
export async function getEventById(id: number): Promise<CivicEvent | null> {
  let cachedEvent: (typeof events.$inferSelect) | null = null;
  
  try {
    // Check cache first
    const cached = await db.select().from(events).where(eq(events.id, id)).limit(1);
    
    if (cached.length > 0) {
      cachedEvent = cached[0];
      if (isCacheFresh(cachedEvent.cachedAt, cachedEvent.startDateTime)) {
        return mapCachedEvent(cachedEvent);
      }
    }
  } catch (error) {
    console.warn('Database cache unavailable:', error);
  }

  // Try to fetch from API
  try {
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
  } catch (apiError) {
    // API failed - fall back to stale cache if available
    console.warn('API unavailable, falling back to stale cache:', apiError);
    if (cachedEvent) {
      console.log(`Serving stale cached event ${id}`);
      return mapCachedEvent(cachedEvent);
    }
    throw apiError; // No cache available, re-throw
  }
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
 * Helper to map cached file to CivicFile format
 */
function mapCachedFile(f: typeof files.$inferSelect): CivicFile {
  return {
    fileId: f.id,
    name: f.name,
    type: f.type,
    url: f.url,
    publishOn: f.publishOn || '',
    fileType: f.fileType || 0,
  };
}

/**
 * Fetch files for an event (via its agendaId)
 */
export async function getEventFiles(eventId: number): Promise<CivicFile[]> {
  let cachedFilesList: (typeof files.$inferSelect)[] = [];
  
  try {
    // Check file cache first - also get the event to determine cache freshness
    const [cachedFiles, cachedEvent] = await Promise.all([
      db.select().from(files).where(eq(files.eventId, eventId)),
      db.select().from(events).where(eq(events.id, eventId)).limit(1)
    ]);
    
    cachedFilesList = cachedFiles;
    
    if (cachedFiles.length > 0 && cachedEvent.length > 0) {
      // Use the event's date to determine if file cache is fresh
      if (isCacheFresh(cachedFiles[0].cachedAt, cachedEvent[0].startDateTime)) {
        return cachedFiles.map(mapCachedFile);
      }
    }
  } catch (error) {
    console.warn('Database cache unavailable:', error);
  }

  // Try to fetch from API
  try {
    // First get the event to find its agendaId
    const event = await getEventById(eventId);
    if (!event || !event.agendaId) {
      return cachedFilesList.length > 0 ? cachedFilesList.map(mapCachedFile) : [];
    }

    // Then get meeting details which contain the files
    const meeting = await getMeetingDetails(event.agendaId);
    if (!meeting) {
      return cachedFilesList.length > 0 ? cachedFilesList.map(mapCachedFile) : [];
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
    } catch (cacheError) {
      console.warn('Failed to cache files:', cacheError);
    }

    return publishedFiles;
  } catch (apiError) {
    // API failed - fall back to stale cache if available
    console.warn('API unavailable for files, falling back to stale cache:', apiError);
    if (cachedFilesList.length > 0) {
      console.log(`Serving ${cachedFilesList.length} stale cached files for event ${eventId}`);
      return cachedFilesList.map(mapCachedFile);
    }
    return []; // Return empty instead of throwing for files
  }
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
  let cachedEvents: (typeof events.$inferSelect)[] = [];
  
  try {
    // Check cache first - fetch all cached events for the date range
    cachedEvents = await db.select().from(events)
      .where(
        and(
          gte(events.startDateTime, new Date(startDate)),
          lt(events.startDateTime, new Date(endDate))
        )
      )
      .orderBy(events.startDateTime);

    // Check if ALL cached events are fresh based on their individual dates
    if (cachedEvents.length > 0) {
      const allFresh = cachedEvents.every(e => isCacheFresh(e.cachedAt, e.startDateTime));
      
      if (allFresh) {
        return cachedEvents.map(mapCachedEvent);
      }
    }
  } catch (error) {
    console.warn('Database cache unavailable, fetching from API:', error);
  }

  // Try to fetch fresh data from API
  let fetchedEvents: CivicEvent[];
  try {
    fetchedEvents = await fetchEventsFromAPI(startDate, endDate);
  } catch (apiError) {
    // API failed - fall back to stale cache if available
    console.warn('API unavailable, falling back to stale cache:', apiError);
    if (cachedEvents.length > 0) {
      console.log(`Serving ${cachedEvents.length} stale cached events with file counts`);
      return cachedEvents.map(mapCachedEvent);
    }
    throw apiError; // No cache available, re-throw
  }

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

// Re-export format helpers for backward compatibility
export { formatEventDate, formatEventTime } from './utils';
