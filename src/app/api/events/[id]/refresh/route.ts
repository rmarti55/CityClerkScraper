import { NextRequest, NextResponse } from 'next/server';
import { refreshEventById } from '@/lib/civicclerk';

export const dynamic = 'force-dynamic';

/**
 * POST /api/events/[id]/refresh
 * Force-fetches a single event from the CivicClerk API, bypassing all caches.
 * Updates the DB with fresh event metadata, file count, and files.
 * Returns { event: CivicEvent, cachedAt: string }.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventId = parseInt(id, 10);

  if (isNaN(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }

  try {
    const event = await refreshEventById(eventId);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(
      { event, cachedAt: event.cachedAt },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error(`Failed to refresh event ${eventId}:`, error);
    return NextResponse.json(
      { error: 'Failed to refresh event data from CivicClerk' },
      { status: 502 }
    );
  }
}
