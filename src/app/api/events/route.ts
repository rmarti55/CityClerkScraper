import { NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { asc, eq } from 'drizzle-orm';
import type { CivicEvent } from '@/lib/types';
import { getMeetingDetails } from '@/lib/civicclerk';

/**
 * GET /api/events
 * Returns all cached events from the database.
 * Used for client-side caching to enable instant month navigation.
 * 
 * For upcoming events with an agendaId but fileCount=0, fetches fresh
 * file counts from the API to ensure accurate display.
 */
export async function GET() {
  try {
    // Fetch all events ordered by date
    const allEvents = await db
      .select()
      .from(events)
      .orderBy(asc(events.startDateTime));

    const now = new Date();
    
    // Find upcoming events with agendaId but missing file counts
    // These likely have agendas published that we haven't cached yet
    // Note: agendaId of 0 means no agenda, so we check for > 0
    const eventsNeedingRefresh = allEvents.filter(e => 
      e.agendaId && 
      e.agendaId > 0 &&
      (e.fileCount || 0) === 0 && 
      e.startDateTime > now
    );

    // Fetch fresh file counts for these events (in parallel, batched)
    const refreshedCounts = new Map<number, { fileCount: number; fileNames: string }>();
    
    if (eventsNeedingRefresh.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < eventsNeedingRefresh.length; i += batchSize) {
        const batch = eventsNeedingRefresh.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (event) => {
            try {
              const meeting = await getMeetingDetails(event.agendaId!);
              const fileCount = meeting?.publishedFiles?.length || 0;
              const fileNames = meeting?.publishedFiles?.map(f => f.name).join(' ') || '';
              return { eventId: event.id, fileCount, fileNames };
            } catch {
              return { eventId: event.id, fileCount: 0, fileNames: '' };
            }
          })
        );
        
        for (const result of results) {
          if (result.fileCount > 0) {
            refreshedCounts.set(result.eventId, { 
              fileCount: result.fileCount, 
              fileNames: result.fileNames 
            });
          }
        }
      }

      // Update the database cache with the new file counts (fire and forget)
      // This ensures subsequent requests are fast
      updateFileCounts(refreshedCounts).catch(err => 
        console.warn('Failed to update file counts cache:', err)
      );
    }

    // Map to CivicEvent format, using refreshed counts where available
    const mappedEvents: CivicEvent[] = allEvents.map((e) => {
      const refreshed = refreshedCounts.get(e.id);
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
        cachedAt: new Date() 
      })
      .where(eq(events.id, eventId));
  }
}
