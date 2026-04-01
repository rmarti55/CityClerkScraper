import { db, events } from '../db';
import { eq, gte, lt, and } from 'drizzle-orm';
import { parseEventStartDateTime } from '../datetime';
import type { CivicEvent, CivicFile } from '../types';
import type { RawApiEvent } from './types';
import {
  API_BASE,
  getHeaders,
  normalizeApiEvent,
  fetchEventsFromAPI,
  fetchEventPublishedFilesFromAPI,
  mergeAndDedupeFileLists,
  isFebruary2026,
  isRangeInPast,
  getMeetingDetails,
  fetchEventNameFromAPI as fetchEventNameFromAPIImpl,
  fetchEventStartDateTimeFromAPI as fetchEventStartDateTimeFromAPIImpl,
} from './api';
import { isCacheFresh, mapCachedEvent, upsertEvent, upsertFiles } from './cache';
import { cacheAgendaItems } from './agenda-cache';

export const fetchEventNameFromAPI = fetchEventNameFromAPIImpl;
export const fetchEventStartDateTimeFromAPI = fetchEventStartDateTimeFromAPIImpl;

/**
 * Fetch events for a given date range (with database caching)
 */
export async function getEvents(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  let cachedEvents: (typeof events.$inferSelect)[] = [];

  try {
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
      if (isRangeInPast(endDate) && hasAllFileNames) {
        console.log(`Serving ${cachedEvents.length} cached events for past range`);
        return cachedEvents.map(mapCachedEvent);
      }
      const allFresh = cachedEvents.every(e => isCacheFresh(e.cachedAt, e.startDateTime, e.fileNames !== null));
      if (allFresh) {
        return cachedEvents.map(mapCachedEvent);
      }
    }
  } catch (error) {
    console.warn('Database cache unavailable, fetching from API:', error);
  }

  try {
    return await fetchEventsFromAPI(startDate, endDate);
  } catch (apiError) {
    console.warn('API unavailable, falling back to stale cache:', apiError);
    if (cachedEvents.length > 0) {
      console.log(`Serving ${cachedEvents.length} stale cached events`);
      return cachedEvents.map(mapCachedEvent);
    }
    throw apiError;
  }
}

/**
 * Fetch a single event by ID
 */
export async function getEventById(id: number): Promise<CivicEvent | null> {
  let cachedEvent: (typeof events.$inferSelect) | null = null;

  try {
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

  try {
    const url = `${API_BASE}/Events/${id}`;

    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        if (cachedEvent) {
          try {
            await db.delete(events).where(eq(events.id, id));
            console.log(`Deleted stale cache entry for event ${id}`);
          } catch (deleteError) {
            console.warn(`Failed to delete stale cache entry for event ${id}:`, deleteError);
          }
        }
        return null;
      }
      throw new Error(`Failed to fetch event: ${response.status}`);
    }

    const raw: RawApiEvent = await response.json();
    const event = normalizeApiEvent(raw);
    try {
      await db
        .update(events)
        .set({
          venueName: event.venueName ?? null,
          venueAddress: event.venueAddress ?? null,
          venueCity: event.venueCity ?? null,
          venueState: event.venueState ?? null,
          venueZip: event.venueZip ?? null,
          cachedAt: new Date(),
        })
        .where(eq(events.id, id));
    } catch {
      // Non-fatal: response still has venue
    }
    return {
      ...event,
      startDateTime: parseEventStartDateTime(event.startDateTime).toISOString(),
    };
  } catch (apiError) {
    console.warn('API unavailable, falling back to stale cache:', apiError);
    if (cachedEvent) {
      console.log(`Serving stale cached event ${id}`);
      return mapCachedEvent(cachedEvent);
    }
    throw apiError;
  }
}

/**
 * Get events with file counts for a date range (with optional database caching).
 * When forceRefresh is true, always fetches from the API and returns that result (then upserts to DB).
 */
export async function getEventsWithFileCounts(
  startDate: string,
  endDate: string,
  options?: { forceRefresh?: boolean }
): Promise<CivicEvent[]> {
  const forceRefresh = options?.forceRefresh === true;
  let cachedEvents: (typeof events.$inferSelect)[] = [];

  if (!forceRefresh) {
    try {
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
        if (isRangeInPast(endDate) && hasAllFileNames) {
          console.log(`Serving ${cachedEvents.length} cached events for past range`);
          return cachedEvents.map(mapCachedEvent);
        }
        const allFresh = cachedEvents.every(e => isCacheFresh(e.cachedAt, e.startDateTime, e.fileNames !== null));
        if (allFresh) {
          return cachedEvents.map(mapCachedEvent);
        }
      }
    } catch (error) {
      console.warn('Database cache unavailable, fetching from API:', error);
    }
  }

  let fetchedEvents: CivicEvent[];
  try {
    fetchedEvents = await fetchEventsFromAPI(startDate, endDate);
  } catch (apiError) {
    if (cachedEvents.length > 0) {
      console.warn('API unavailable, falling back to stale cache:', apiError);
      console.log(`Serving ${cachedEvents.length} stale cached events with file counts`);
      return cachedEvents.map(mapCachedEvent);
    }
    console.warn('API unavailable:', apiError);
    throw apiError;
  }

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
          if (meeting?.items?.length) {
            cacheAgendaItems(event.id, event.agendaId, meeting.items).catch(() => {});
          }
          return { ...event, fileCount, fileNames };
        } catch {
          return { ...event, fileCount: 0, fileNames: '' };
        }
      })
    );
    eventsWithCounts.push(...batchResults);
  }

  try {
    for (const e of eventsWithCounts) {
      await upsertEvent(e);
    }
  } catch (error) {
    console.warn('Failed to cache events:', error);
  }

  const upsertedAt = new Date().toISOString();
  return eventsWithCounts.map(e => ({
    ...e,
    startDateTime: parseEventStartDateTime(e.startDateTime).toISOString(),
    cachedAt: upsertedAt,
  }));
}

/**
 * Force-refresh a single event from the CivicClerk API, bypassing all caches.
 * Fetches event metadata and meeting file details, then upserts both to the DB
 * with an updated cachedAt timestamp. Returns the fresh CivicEvent with cachedAt set.
 */
export async function refreshEventById(id: number): Promise<CivicEvent | null> {
  const response = await fetch(`${API_BASE}/Events/${id}`, {
    headers: getHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch event: ${response.status}`);
  }

  const raw: RawApiEvent = await response.json();
  const event = normalizeApiEvent(raw);
  const now = new Date();

  let fileCount = event.fileCount ?? 0;
  let fileNames = event.fileNames ?? '';
  let publishedFiles: CivicFile[] = [];

  if (event.agendaId != null) {
    try {
      const meeting = await getMeetingDetails(event.agendaId);
      if (meeting?.publishedFiles) {
        publishedFiles = meeting.publishedFiles;
        fileCount = publishedFiles.length;
        fileNames = publishedFiles.map(f => f.name).join(' ');
      }
      if (meeting?.items?.length) {
        cacheAgendaItems(id, event.agendaId, meeting.items).catch(() => {});
      }
    } catch {
      // Non-fatal
    }
  }

  if (isFebruary2026(new Date(event.startDateTime))) {
    try {
      const eventFiles = await fetchEventPublishedFilesFromAPI(id);
      publishedFiles = mergeAndDedupeFileLists(publishedFiles, eventFiles);
      fileCount = publishedFiles.length;
      fileNames = publishedFiles.map(f => f.name).join(' ');
    } catch {
      // Non-fatal
    }
  }

  try {
    await upsertEvent(event, { fileCount, fileNames, cachedAt: now });
  } catch (error) {
    console.warn('Failed to update event cache:', error);
  }

  try {
    await upsertFiles(id, publishedFiles, { cachedAt: now });
  } catch (error) {
    console.warn('Failed to update file cache:', error);
  }

  return {
    ...event,
    startDateTime: parseEventStartDateTime(event.startDateTime).toISOString(),
    fileCount,
    fileNames,
    cachedAt: now.toISOString(),
  };
}
