import { NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { asc } from 'drizzle-orm';
import type { CivicEvent } from '@/lib/types';

/**
 * GET /api/events
 * Returns all cached events from the database.
 * Used for client-side caching to enable instant month navigation.
 */
export async function GET() {
  try {
    // Fetch all events ordered by date
    const allEvents = await db
      .select()
      .from(events)
      .orderBy(asc(events.startDateTime));

    // Map to CivicEvent format
    const mappedEvents: CivicEvent[] = allEvents.map((e) => ({
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
    }));

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
