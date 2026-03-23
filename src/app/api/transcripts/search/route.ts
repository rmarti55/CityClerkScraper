import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, meetingTranscripts, meetingVideos, events } from '@/lib/db';

/**
 * GET /api/transcripts/search?q=water+rates&limit=20
 * Full-text search across all meeting transcripts.
 * Uses PostgreSQL ILIKE for simplicity (tsvector can be added later for perf).
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20'), 50);

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    const searchPattern = `%${query.trim()}%`;

    const results = await db
      .select({
        transcriptId: meetingTranscripts.id,
        eventId: meetingTranscripts.eventId,
        cleanedTranscript: meetingTranscripts.cleanedTranscript,
        summaryJson: meetingTranscripts.summaryJson,
        videoTitle: meetingVideos.youtubeTitle,
        youtubeVideoId: meetingVideos.youtubeVideoId,
        eventName: events.eventName,
        eventDate: events.eventDate,
        categoryName: events.categoryName,
      })
      .from(meetingTranscripts)
      .innerJoin(meetingVideos, sql`${meetingTranscripts.videoId} = ${meetingVideos.id}`)
      .innerJoin(events, sql`${meetingTranscripts.eventId} = ${events.id}`)
      .where(
        sql`(${meetingTranscripts.cleanedTranscript} ILIKE ${searchPattern} OR ${meetingTranscripts.rawTranscript} ILIKE ${searchPattern})`,
      )
      .limit(limit);

    const hits = results.map((r) => {
      // Extract a snippet around the match
      const text = r.cleanedTranscript || '';
      const lowerText = text.toLowerCase();
      const lowerQuery = query.trim().toLowerCase();
      const matchIdx = lowerText.indexOf(lowerQuery);
      let snippet = '';
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 100);
        const end = Math.min(text.length, matchIdx + lowerQuery.length + 100);
        snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
      }

      return {
        transcriptId: r.transcriptId,
        eventId: r.eventId,
        eventName: r.eventName,
        eventDate: r.eventDate,
        categoryName: r.categoryName,
        videoTitle: r.videoTitle,
        youtubeVideoId: r.youtubeVideoId,
        snippet,
      };
    });

    return NextResponse.json({ query: query.trim(), count: hits.length, results: hits });
  } catch (error) {
    console.error('Transcript search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
