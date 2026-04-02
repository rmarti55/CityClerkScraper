import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, meetingVideos } from '@/lib/db';

interface RouteParams {
  params: Promise<{ videoId: string }>;
}

/**
 * POST /api/admin/videos/[videoId]/link
 * Manually link a YouTube video to a CivicClerk event.
 * Body: { eventId: number }
 * Protected by CRON_SECRET.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { videoId: videoIdStr } = await params;
    const videoId = parseInt(videoIdStr);
    if (isNaN(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const body = await request.json();
    const eventId = body.eventId;
    if (!eventId || typeof eventId !== 'number') {
      return NextResponse.json({ error: 'eventId is required and must be a number' }, { status: 400 });
    }

    const updated = await db
      .update(meetingVideos)
      .set({ eventId, matchConfidence: 100, matchMethod: 'manual', matchedAt: new Date() })
      .where(eq(meetingVideos.id, videoId))
      .returning({ id: meetingVideos.id });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, videoId, eventId });
  } catch (error) {
    console.error('Video link error:', error);
    return NextResponse.json({ error: 'Failed to link video' }, { status: 500 });
  }
}
