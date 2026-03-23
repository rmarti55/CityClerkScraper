import { NextRequest, NextResponse } from 'next/server';
import { runTranscriptPipeline } from '@/lib/youtube/pipeline';

/**
 * GET /api/cron/transcripts
 * Runs the YouTube transcript discovery, extraction, and AI processing pipeline.
 * Secure with CRON_SECRET (header or query). Call from Vercel Cron or external scheduler.
 *
 * Recommended schedule: every 6 hours (4x/day).
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 503 });
  }

  try {
    // Look back 3 months for new videos
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const result = await runTranscriptPipeline({
      publishedAfter: threeMonthsAgo.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
