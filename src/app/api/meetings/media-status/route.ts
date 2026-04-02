import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, meetingVideos, meetingTranscripts, events } from '@/lib/db';
import { checkLiveStream } from '@/lib/youtube/live';

export interface MediaStatusEntry {
  hasVideo: boolean;
  hasTranscript: boolean;
  hasZoomLink: boolean;
  isLive?: boolean;
  liveVideoId?: string;
  digest?: string;
}

export interface MediaStatusMap {
  [eventId: string]: MediaStatusEntry;
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

    // Zoom links + digests for these events
    const eventRows = await db
      .select({ id: events.id, zoomLink: events.zoomLink, digest: events.digest })
      .from(events)
      .where(sql`${events.id} IN (${sql.raw(idList)})`);
    const zoomEventIds = new Set(
      eventRows.filter((r) => r.zoomLink && r.zoomLink !== '__none__').map((r) => r.id),
    );
    const digestMap = new Map(
      eventRows.filter((r) => r.digest).map((r) => [r.id, r.digest!]),
    );

    // Check for active live stream
    let liveEventId: number | undefined;
    let liveVideoId: string | undefined;
    try {
      const liveStatus = await checkLiveStream();
      if (liveStatus.isLive && liveStatus.eventId && eventIds.includes(liveStatus.eventId)) {
        liveEventId = liveStatus.eventId;
        liveVideoId = liveStatus.videoId;
      }
    } catch {
      // Live check is best-effort; don't fail the whole request
    }

    const result: MediaStatusMap = {};
    for (const id of eventIds) {
      const entry: MediaStatusEntry = {
        hasVideo: videoEventIds.has(id),
        hasTranscript: transcriptEventIds.has(id),
        hasZoomLink: zoomEventIds.has(id),
      };
      if (id === liveEventId) {
        entry.isLive = true;
        entry.liveVideoId = liveVideoId;
      }
      const digest = digestMap.get(id);
      if (digest) {
        entry.digest = digest;
      }
      result[String(id)] = entry;
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Media status error:', error);
    return NextResponse.json({ error: 'Failed to fetch media status' }, { status: 500 });
  }
}
