import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { asc, inArray } from 'drizzle-orm';
import type { CivicEvent } from '@/lib/types';
import { getEventsWithFileCounts } from '@/lib/civicclerk';

/** Always run fresh so dashboard gets API data for the requested month. */
export const dynamic = 'force-dynamic';

/** Month param format: YYYY-MM (e.g. 2026-02). Defaults to current month if missing. */
const MONTH_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

function rowToCivicEvent(e: {
  id: number;
  eventName: string;
  eventDescription: string | null;
  eventDate: string;
  startDateTime: Date;
  agendaId: number | null;
  agendaName: string | null;
  categoryName: string | null;
  isPublished: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  venueState: string | null;
  venueZip: string | null;
  fileCount: number | null;
  fileNames: string | null;
}): CivicEvent {
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
    venueName: e.venueName ?? undefined,
    venueAddress: e.venueAddress ?? undefined,
    venueCity: e.venueCity ?? undefined,
    venueState: e.venueState ?? undefined,
    venueZip: e.venueZip ?? undefined,
    fileCount: e.fileCount ?? 0,
    fileNames: e.fileNames ?? undefined,
  };
}

/**
 * GET /api/events?eventIds=1,2,3
 * Returns only the requested events from the database (no external API refresh).
 * Used by My Follow page for fast loading of followed meetings.
 */
export async function GET(request: NextRequest) {
  const eventIdsParam = request.nextUrl.searchParams.get('eventIds');
  if (eventIdsParam) {
    const ids = eventIdsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length > 0) {
      try {
        const rows = await db
          .select()
          .from(events)
          .where(inArray(events.id, ids))
          .orderBy(asc(events.startDateTime));
        const mappedEvents: CivicEvent[] = rows.map(rowToCivicEvent);
        return NextResponse.json({
          events: mappedEvents,
          count: mappedEvents.length,
          fetchedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to fetch events by IDs:', error);
        return NextResponse.json(
          { error: 'Failed to fetch events' },
          { status: 500 }
        );
      }
    }
  }

  // Main path: month-scoped, API-first. Client sends month=YYYY-MM (defaults to current month).
  const monthParam = request.nextUrl.searchParams.get('month')?.trim();
  const now = new Date();
  let year: number;
  let month: number;
  if (monthParam && MONTH_REGEX.test(monthParam)) {
    const [, y, m] = monthParam.match(MONTH_REGEX)!;
    year = parseInt(y!, 10);
    month = parseInt(m!, 10);
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  try {
    const eventsForMonth = await getEventsWithFileCounts(startDate, endDate, {
      forceRefresh: true,
    });
    return NextResponse.json(
      {
        events: eventsForMonth,
        count: eventsForMonth.length,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch events for month:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

