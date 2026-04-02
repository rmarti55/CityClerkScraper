import { NextResponse } from 'next/server';
import { checkLiveStream } from '@/lib/youtube/live';

/**
 * GET /api/youtube/live
 *
 * Returns the current live stream status for the City of Santa Fe YouTube channel.
 * Response is cached server-side for 60s to conserve YouTube API quota.
 */
export async function GET() {
  try {
    const result = await checkLiveStream();

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Live stream API error:', error);
    return NextResponse.json(
      { isLive: false },
      { status: 200 },
    );
  }
}
