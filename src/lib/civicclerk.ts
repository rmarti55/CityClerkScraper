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
 * True if the requested date range is entirely in the past (end of range before today).
 * For past ranges we prefer DB whenever we have any cached data (no API refetch).
 */
function isRangeInPast(endDate: string): boolean {
  const end = new Date(endDate);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return end < startOfToday;
}

/**
 * Check if cached data is still fresh based on event date
 * Uses age-based caching: older events have longer cache duration
 */
function isCacheFresh(cachedAt: Date | null, eventDate: Date, hasFileNames?: boolean): boolean {
  if (!cachedAt) return false;
  // If fileNames is missing, cache is incomplete and needs refresh
  if (hasFileNames === false) return false;
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
    fileNames: e.fileNames || undefined,
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

    if (cachedEvents.length > 0) {
      const hasAllFileNames = cachedEvents.every(e => e.fileNames !== null);
      // For past ranges, serve from DB only if we have complete data (including fileNames)
      if (isRangeInPast(endDate) && hasAllFileNames) {
        console.log(`Serving ${cachedEvents.length} cached events for past range`);
        return cachedEvents.map(mapCachedEvent);
      }
      // For current/future ranges, require all cached events to be fresh
      const allFresh = cachedEvents.every(e => isCacheFresh(e.cachedAt, e.startDateTime, e.fileNames !== null));
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
      if (isCacheFresh(cachedEvent.cachedAt, cachedEvent.startDateTime, cachedEvent.fileNames !== null)) {
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

    if (cachedEvents.length > 0) {
      const hasAllFileNames = cachedEvents.every(e => e.fileNames !== null);
      // For past ranges, serve from DB only if we have complete data (including fileNames)
      if (isRangeInPast(endDate) && hasAllFileNames) {
        console.log(`Serving ${cachedEvents.length} cached events for past range`);
        return cachedEvents.map(mapCachedEvent);
      }
      // For current/future ranges, require all cached events to be fresh
      const allFresh = cachedEvents.every(e => isCacheFresh(e.cachedAt, e.startDateTime, e.fileNames !== null));
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
            return { ...event, fileCount: 0, fileNames: '' };
          }
          const meeting = await getMeetingDetails(event.agendaId);
          const fileCount = meeting?.publishedFiles?.length || 0;
          const fileNames = meeting?.publishedFiles?.map(f => f.name).join(' ') || '';
          return { ...event, fileCount, fileNames };
        } catch {
          return { ...event, fileCount: 0, fileNames: '' };
        }
      })
    );
    eventsWithCounts.push(...batchResults);
  }

  // Cache the events with file counts
  try {
    if (eventsWithCounts.length > 0) {
      // Upsert events one by one to ensure fileNames gets updated
      for (const e of eventsWithCounts) {
        await db.insert(events)
          .values({
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
            fileNames: e.fileNames || '',
            cachedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: events.id,
            set: {
              eventName: e.eventName,
              eventDescription: e.eventDescription,
              agendaId: e.agendaId,
              agendaName: e.agendaName,
              categoryName: e.categoryName,
              fileCount: e.fileCount || 0,
              fileNames: e.fileNames || '',
              cachedAt: new Date(),
            },
          });
      }
    }
  } catch (error) {
    console.warn('Failed to cache events:', error);
  }

  return eventsWithCounts;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BackfillResult {
  eventsCount: number;
  meetingsCalls: number;
}

/**
 * Backfill a date range from the API into the database (no cache check).
 * Fetches events, then meeting details in batches with throttle, then upserts events and files.
 * Use for one-time historical backfill (e.g. last 5 years).
 */
export async function backfillDateRange(
  startDate: string,
  endDate: string,
  options?: { throttleMs?: number }
): Promise<BackfillResult> {
  const throttleMs = options?.throttleMs ?? 150;
  const batchSize = 5;

  const fetchedEvents = await fetchEventsFromAPI(startDate, endDate);
  const eventsWithCounts: CivicEvent[] = [];
  const filesToUpsert: { eventId: number; file: CivicFile }[] = [];

  for (let i = 0; i < fetchedEvents.length; i += batchSize) {
    const batch = fetchedEvents.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (event) => {
        try {
          if (!event.agendaId) {
            return { ...event, fileCount: 0, fileNames: '' };
          }
          const meeting = await getMeetingDetails(event.agendaId);
          const fileCount = meeting?.publishedFiles?.length || 0;
          const fileNames = meeting?.publishedFiles?.map((f) => f.name).join(' ') || '';
          if (meeting?.publishedFiles?.length) {
            filesToUpsert.push(
              ...meeting.publishedFiles.map((f) => ({ eventId: event.id, file: f }))
            );
          }
          return { ...event, fileCount, fileNames };
        } catch {
          return { ...event, fileCount: 0, fileNames: '' };
        }
      })
    );
    eventsWithCounts.push(...batchResults);
    if (i + batchSize < fetchedEvents.length) {
      await sleep(throttleMs);
    }
  }

  const meetingsCalls = eventsWithCounts.filter((e) => e.agendaId).length;

  if (eventsWithCounts.length > 0) {
    // Upsert events one by one to ensure fileNames gets updated
    // (Drizzle's onConflictDoUpdate with table refs keeps old values)
    for (const e of eventsWithCounts) {
      await db
        .insert(events)
        .values({
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
          fileNames: e.fileNames || '',
          cachedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: events.id,
          set: {
            eventName: e.eventName,
            eventDescription: e.eventDescription,
            agendaId: e.agendaId,
            agendaName: e.agendaName,
            categoryName: e.categoryName,
            fileCount: e.fileCount || 0,
            fileNames: e.fileNames || '',
            cachedAt: new Date(),
          },
        });
    }
  }

  if (filesToUpsert.length > 0) {
    const fileRows = filesToUpsert.map(({ eventId, file: f }) => ({
      id: f.fileId,
      eventId,
      name: f.name,
      type: f.type,
      url: f.url,
      publishOn: f.publishOn,
      fileType: f.fileType,
      cachedAt: new Date(),
    }));
    for (let i = 0; i < fileRows.length; i += 100) {
      const chunk = fileRows.slice(i, i + 100);
      await db
        .insert(files)
        .values(chunk)
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
  }

  return { eventsCount: eventsWithCounts.length, meetingsCalls };
}

// Re-export format helpers for backward compatibility
export { formatEventDate, formatEventTime } from './utils';

/**
 * Search events across all time periods with pagination
 * Returns future events first (ascending), then past events (descending)
 */
export async function searchEvents(
  query: string,
  page: number = 1,
  limit: number = 20
): Promise<{ events: CivicEvent[]; total: number }> {
  const offset = (page - 1) * limit;
  const searchPattern = `%${query}%`;
  const now = new Date();

  try {
    // Use raw SQL for the complex ordering and ILIKE search
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);

    // Count total matching events
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM events
      WHERE 
        event_name ILIKE ${searchPattern}
        OR category_name ILIKE ${searchPattern}
        OR agenda_name ILIKE ${searchPattern}
        OR event_description ILIKE ${searchPattern}
        OR venue_name ILIKE ${searchPattern}
    `;
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Fetch paginated results with custom ordering:
    // Future events first (ascending by date), then past events (descending by date)
    const results = await sql`
      SELECT 
        id,
        event_name,
        event_description,
        event_date,
        start_date_time,
        agenda_id,
        agenda_name,
        category_name,
        is_published,
        venue_name,
        venue_address,
        venue_city,
        venue_state,
        venue_zip,
        file_count
      FROM events
      WHERE 
        event_name ILIKE ${searchPattern}
        OR category_name ILIKE ${searchPattern}
        OR agenda_name ILIKE ${searchPattern}
        OR event_description ILIKE ${searchPattern}
        OR venue_name ILIKE ${searchPattern}
      ORDER BY 
        CASE WHEN start_date_time >= ${now} THEN 0 ELSE 1 END,
        CASE WHEN start_date_time >= ${now} THEN start_date_time END ASC,
        CASE WHEN start_date_time < ${now} THEN start_date_time END DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Map database results to CivicEvent format
    // Note: Neon returns timestamps as strings, so we need to handle both cases
    const events: CivicEvent[] = results.map((row: Record<string, unknown>) => {
      const startDateTime = row.start_date_time;
      const isoDateTime = startDateTime instanceof Date 
        ? startDateTime.toISOString() 
        : String(startDateTime);
      
      return {
        id: row.id as number,
        eventName: row.event_name as string,
        eventDescription: (row.event_description as string) || '',
        eventDate: row.event_date as string,
        startDateTime: isoDateTime,
        agendaId: row.agenda_id as number | null,
        agendaName: (row.agenda_name as string) || '',
        categoryName: (row.category_name as string) || '',
        isPublished: (row.is_published as string) || '',
        venueName: (row.venue_name as string) || undefined,
        venueAddress: (row.venue_address as string) || undefined,
        venueCity: (row.venue_city as string) || undefined,
        venueState: (row.venue_state as string) || undefined,
        venueZip: (row.venue_zip as string) || undefined,
        fileCount: (row.file_count as number) || 0,
      };
    });

    return { events, total };
  } catch (error) {
    console.error('Search query failed:', error);
    throw new Error('Failed to search events');
  }
}
