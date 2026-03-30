import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, meetingVideos, meetingTranscripts, events } from '@/lib/db';

export interface MediaStatusMap {
  [eventId: string]: {
    hasVideo: boolean;
    hasTranscript: boolean;
    hasZoomLink: boolean;
  };
}

/**
 * GET /api/meetings/media-status?ids=917,962,963
 * Returns media availability flags for a batch of event IDs.
 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'ids parameter required' }, { status: 400 });
  }

  const eventIds = idsParam.split(',').map(Number).filter((n) => !isNaN(n));
  if (eventIds.length === 0) {
    return NextResponse.json({});
  }

  try {
    const idList = eventIds.join(',');

    // Videos linked to these events
    const videoRows = await db
      .select({ eventId: meetingVideos.eventId })
      .from(meetingVideos)
      .where(sql`${meetingVideos.eventId} IN (${sql.raw(idList)})`);
    const videoEventIds = new Set(videoRows.map((r) => r.eventId));

    // Completed transcripts for these events
    const transcriptRows = await db
      .select({ eventId: meetingTranscripts.eventId })
      .from(meetingTranscripts)
      .where(
        sql`${meetingTranscripts.eventId} IN (${sql.raw(idList)}) AND ${meetingTranscripts.status} = 'completed'`,
      );
    const transcriptEventIds = new Set(transcriptRows.map((r) => r.eventId));

    // Zoom links for these events
    const zoomRows = await db
      .select({ id: events.id, zoomLink: events.zoomLink })
      .from(events)
      .where(sql`${events.id} IN (${sql.raw(idList)})`);
    const zoomEventIds = new Set(
      zoomRows.filter((r) => r.zoomLink && r.zoomLink !== '__none__').map((r) => r.id),
    );

    const result: MediaStatusMap = {};
    for (const id of eventIds) {
      result[String(id)] = {
        hasVideo: videoEventIds.has(id),
        hasTranscript: transcriptEventIds.has(id),
        hasZoomLink: zoomEventIds.has(id),
      };
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Media status error:', error);
    return NextResponse.json({ error: 'Failed to fetch media status' }, { status: 500 });
  }
}
