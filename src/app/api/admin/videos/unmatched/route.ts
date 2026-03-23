import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, meetingVideos } from '@/lib/db';

/**
 * GET /api/admin/videos/unmatched
 * List YouTube videos that couldn't be auto-matched to events (eventId = 0).
 * Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const unmatched = await db
      .select()
      .from(meetingVideos)
      .where(eq(meetingVideos.eventId, 0));

    return NextResponse.json({
      count: unmatched.length,
      videos: unmatched.map((v) => ({
        id: v.id,
        youtubeVideoId: v.youtubeVideoId,
        title: v.youtubeTitle,
        publishedAt: v.youtubePublishedAt,
        thumbnailUrl: v.youtubeThumbnailUrl,
        matchConfidence: v.matchConfidence,
      })),
    });
  } catch (error) {
    console.error('Unmatched videos error:', error);
    return NextResponse.json({ error: 'Failed to fetch unmatched videos' }, { status: 500 });
  }
}
