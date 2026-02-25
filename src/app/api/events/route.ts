import { NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { asc, eq } from 'drizzle-orm';
import type { CivicEvent } from '@/lib/types';
import {
  getMeetingDetails,
  fetchEventNameFromAPI,
  fetchEventStartDateTimeFromAPI,
} from '@/lib/civicclerk';
import { parseEventStartDateTime } from '@/lib/datetime';

/** Events within this many days in the past are refreshed when fileCount=0 (agendas may have been published after cache). Use 31 to cover full current month. */
const RECENT_PAST_DAYS = 31;
const RECENT_PAST_MS = RECENT_PAST_DAYS * 24 * 60 * 60 * 1000;

/**
 * GET /api/events
 * Returns all cached events from the database.
 * Used for client-side caching to enable instant month navigation.
 *
 * For upcoming events, and recent-past events, with agendaId but fileCount=0,
 * fetches fresh file counts from the API to ensure accurate display.
 */
export async function GET() {
  try {
    // Fetch all events ordered by date
    const allEvents = await db
      .select()
      .from(events)
      .orderBy(asc(events.startDateTime));

    const now = new Date();
    const recentPastStart = new Date(now.getTime() - RECENT_PAST_MS);

    // Events that are upcoming or recent-past: refresh event names from API so list and detail stay in sync (e.g. "Canceled - ...")
    const isUpcomingOrRecentPast = (e: { startDateTime: Date }) => {
      const isUpcoming = e.startDateTime > now;
      const isRecentPast = e.startDateTime >= recentPastStart && e.startDateTime <= now;
      return isUpcoming || isRecentPast;
    };
    const eventsNeedingNameRefresh = allEvents.filter(isUpcomingOrRecentPast);

    // Find events with agendaId but missing file counts that are upcoming or recent-past
    const eventsNeedingFileRefresh = allEvents.filter((e) => {
      if (!e.agendaId || e.agendaId <= 0 || (e.fileCount || 0) !== 0) return false;
      return isUpcomingOrRecentPast(e);
    });

    // Refresh event names from API (batch) so dashboard shows same titles as detail page
    const refreshedNames = new Map<number, string>();
    if (eventsNeedingNameRefresh.length > 0) {
      const nameBatchSize = 5;
      for (let i = 0; i < eventsNeedingNameRefresh.length; i += nameBatchSize) {
        const batch = eventsNeedingNameRefresh.slice(i, i + nameBatchSize);
        const results = await Promise.all(
          batch.map(async (event) => {
            const name = await fetchEventNameFromAPI(event.id);
            return { eventId: event.id, eventName: name };
          })
        );
        for (const r of results) {
          if (r.eventName != null) refreshedNames.set(r.eventId, r.eventName);
        }
      }
      updateEventNames(refreshedNames).catch(err =>
        console.warn('Failed to update event names cache:', err)
      );
    }

    // Refresh start_date_time from API for upcoming + recent-past so times stay correct (e.g. 4 PM not 9 AM)
    const refreshedStartDateTimes = new Map<number, Date>();
    if (eventsNeedingNameRefresh.length > 0) {
      const timeBatchSize = 5;
      for (let i = 0; i < eventsNeedingNameRefresh.length; i += timeBatchSize) {
        const batch = eventsNeedingNameRefresh.slice(i, i + timeBatchSize);
        const results = await Promise.all(
          batch.map(async (event) => {
            const raw = await fetchEventStartDateTimeFromAPI(event.id);
            if (raw == null) return { eventId: event.id, date: null as Date | null };
            const date = parseEventStartDateTime(raw);
            return { eventId: event.id, date: Number.isNaN(date.getTime()) ? null : date };
          })
        );
        for (const r of results) {
          if (r.date != null) refreshedStartDateTimes.set(r.eventId, r.date);
        }
      }
      updateStartDateTimes(refreshedStartDateTimes).catch(err =>
        console.warn('Failed to update start_date_time cache:', err)
      );
    }

    // Fetch fresh file counts for events that need it (in parallel, batched)
    const refreshedCounts = new Map<number, { fileCount: number; fileNames: string }>();
    if (eventsNeedingFileRefresh.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < eventsNeedingFileRefresh.length; i += batchSize) {
        const batch = eventsNeedingFileRefresh.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (event) => {
            try {
              const meeting = await getMeetingDetails(event.agendaId!);
              const fileCount = meeting?.publishedFiles?.length || 0;
              const fileNames = meeting?.publishedFiles?.map(f => f.name).join(' ') || '';
              return { eventId: event.id, fileCount, fileNames };
            } catch (err) {
              console.warn(`[events] getMeetingDetails failed eventId=${event.id} agendaId=${event.agendaId}`, err);
              return { eventId: event.id, fileCount: 0, fileNames: '' };
            }
          })
        );
        for (const result of results) {
          if (result.fileCount > 0) {
            refreshedCounts.set(result.eventId, {
              fileCount: result.fileCount,
              fileNames: result.fileNames,
            });
          }
        }
      }
      updateFileCounts(refreshedCounts).catch(err =>
        console.warn('Failed to update file counts cache:', err)
      );
    }

    // Map to CivicEvent format, using refreshed names, times, and counts where available
    const mappedEvents: CivicEvent[] = allEvents.map((e) => {
      const refreshed = refreshedCounts.get(e.id);
      const eventName = refreshedNames.get(e.id) ?? e.eventName;
      const startDateTime = refreshedStartDateTimes.get(e.id) ?? e.startDateTime;
      return {
        id: e.id,
        eventName,
        eventDescription: e.eventDescription || '',
        eventDate: e.eventDate,
        startDateTime: startDateTime.toISOString(),
        agendaId: e.agendaId,
        agendaName: e.agendaName || '',
        categoryName: e.categoryName || '',
        isPublished: e.isPublished || '',
        venueName: e.venueName || undefined,
        venueAddress: e.venueAddress || undefined,
        venueCity: e.venueCity || undefined,
        venueState: e.venueState || undefined,
        venueZip: e.venueZip || undefined,
        fileCount: refreshed?.fileCount ?? e.fileCount ?? 0,
        fileNames: refreshed?.fileNames ?? e.fileNames ?? undefined,
      };
    });

    return NextResponse.json({
      events: mappedEvents,
      count: mappedEvents.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch all events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * Update file counts in the database cache for the given events.
 * This runs asynchronously to not block the response.
 */
async function updateFileCounts(
  counts: Map<number, { fileCount: number; fileNames: string }>
): Promise<void> {
  for (const [eventId, { fileCount, fileNames }] of counts) {
    await db
      .update(events)
      .set({
        fileCount,
        fileNames,
        cachedAt: new Date(),
      })
      .where(eq(events.id, eventId));
  }
}

/**
 * Update event names in the database cache so list and detail views stay in sync (e.g. "Canceled - ...").
 */
async function updateEventNames(names: Map<number, string>): Promise<void> {
  for (const [eventId, eventName] of names) {
    await db
      .update(events)
      .set({ eventName, cachedAt: new Date() })
      .where(eq(events.id, eventId));
  }
}

/**
 * Update start_date_time in the database cache so meeting times display correctly (e.g. 4 PM not 9 AM).
 */
async function updateStartDateTimes(times: Map<number, Date>): Promise<void> {
  for (const [eventId, startDateTime] of times) {
    await db
      .update(events)
      .set({ startDateTime, cachedAt: new Date() })
      .where(eq(events.id, eventId));
  }
}
