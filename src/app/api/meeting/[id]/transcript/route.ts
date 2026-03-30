import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, meetingVideos, meetingTranscripts } from '@/lib/db';
import { extractTranscript } from '@/lib/youtube/transcript';
import { processTranscript } from '@/lib/youtube/ai-processor';
import { auth } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meeting/[id]/transcript
 * Returns transcript data for a meeting (video info, summary, speakers, topics, cleaned text).
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    // Find video linked to this event
    const videos = await db
      .select()
      .from(meetingVideos)
      .where(eq(meetingVideos.eventId, eventId))
      .limit(1);

    if (videos.length === 0) {
      return NextResponse.json({ hasTranscript: false });
    }

    const video = videos[0];

    // Find transcript for this video
    const transcripts = await db
      .select()
      .from(meetingTranscripts)
      .where(eq(meetingTranscripts.videoId, video.id))
      .limit(1);

    const transcript = transcripts[0] ?? null;

    return NextResponse.json(
      {
        hasTranscript: true,
        video: {
          id: video.id,
          youtubeVideoId: video.youtubeVideoId,
          title: video.youtubeTitle,
          thumbnailUrl: video.youtubeThumbnailUrl,
          duration: video.duration,
          source: video.source,
          matchConfidence: video.matchConfidence,
        },
        transcript: transcript
          ? {
              id: transcript.id,
              status: transcript.status,
              cleanedTranscript: transcript.cleanedTranscript,
              summary: transcript.summaryJson ? JSON.parse(transcript.summaryJson) : null,
              speakers: transcript.speakersJson ? JSON.parse(transcript.speakersJson) : null,
              topics: transcript.topicsJson ? JSON.parse(transcript.topicsJson) : null,
              model: transcript.model,
              generatedAt: transcript.generatedAt,
              errorMessage: transcript.errorMessage,
            }
          : null,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    console.error('Transcript API error:', error);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}

/**
 * POST /api/meeting/[id]/transcript
 * Trigger transcript extraction and AI processing for a meeting's video.
 * Accepts either CRON_SECRET or an authenticated user session.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;
  const hasCronSecret = expected && secret === expected;

  const session = !hasCronSecret ? await auth() : null;
  const hasUserSession = !!session?.user?.id;

  if (!hasCronSecret && !hasUserSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const videos = await db
      .select()
      .from(meetingVideos)
      .where(eq(meetingVideos.eventId, eventId))
      .limit(1);

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No video linked to this event' }, { status: 404 });
    }

    const video = videos[0];

    // Extract transcript
    const extracted = await extractTranscript(video.youtubeVideoId);
    if (!extracted) {
      return NextResponse.json({ error: 'No transcript available' }, { status: 404 });
    }

    // Upsert transcript row
    const existing = await db
      .select()
      .from(meetingTranscripts)
      .where(eq(meetingTranscripts.videoId, video.id))
      .limit(1);

    let transcriptId: number;

    if (existing.length > 0) {
      await db
        .update(meetingTranscripts)
        .set({ rawTranscript: extracted.fullText, status: 'pending', errorMessage: null })
        .where(eq(meetingTranscripts.id, existing[0].id));
      transcriptId = existing[0].id;
    } else {
      const result = await db
        .insert(meetingTranscripts)
        .values({
          videoId: video.id,
          eventId,
          rawTranscript: extracted.fullText,
          status: 'pending',
        })
        .returning({ id: meetingTranscripts.id });
      transcriptId = result[0].id;
    }

    // Run AI processing if available
    if (process.env.OPENROUTER_API_KEY) {
      await db
        .update(meetingTranscripts)
        .set({ status: 'processing' })
        .where(eq(meetingTranscripts.id, transcriptId));

      try {
        const result = await processTranscript(extracted.fullText);
        await db
          .update(meetingTranscripts)
          .set({
            cleanedTranscript: result.cleanedTranscript,
            summaryJson: JSON.stringify(result.summary),
            speakersJson: JSON.stringify(result.speakers),
            topicsJson: JSON.stringify(result.topics),
            model: result.model,
            status: 'completed',
            generatedAt: new Date(),
          })
          .where(eq(meetingTranscripts.id, transcriptId));
      } catch (aiError) {
        await db
          .update(meetingTranscripts)
          .set({
            status: 'failed',
            errorMessage: aiError instanceof Error ? aiError.message : 'AI processing failed',
          })
          .where(eq(meetingTranscripts.id, transcriptId));
      }
    }

    return NextResponse.json({ ok: true, transcriptId });
  } catch (error) {
    console.error('Transcript refresh error:', error);
    return NextResponse.json({ error: 'Failed to process transcript' }, { status: 500 });
  }
}
