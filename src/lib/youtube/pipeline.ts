/**
 * Orchestrates the full YouTube transcript pipeline:
 *   1. Discover new videos from the YouTube channel
 *   2. Auto-match videos to CivicClerk events
 *   3. Extract transcripts for unprocessed videos
 *   4. Run AI processing on raw transcripts
 *
 * Designed to be called from a cron endpoint or backfill script.
 */

import { eq, and, inArray, gte, isNull } from 'drizzle-orm';
import { db, meetingVideos, meetingTranscripts, events } from '@/lib/db';
import { listChannelVideos, getVideoDetails } from './channel';
import { extractTranscript } from './transcript';
import { matchVideosToEvents, AUTO_LINK_THRESHOLD, type MatchCandidate } from './matcher';
import { processTranscript } from './ai-processor';

export interface PipelineResult {
  videosDiscovered: number;
  videosMatched: number;
  transcriptsExtracted: number;
  transcriptsProcessed: number;
  errors: string[];
}

/**
 * Step 1: Discover new YouTube videos not already in the database.
 */
export async function discoverNewVideos(publishedAfter?: string): Promise<number> {
  const videos = await listChannelVideos({ publishedAfter, maxResults: 200 });
  if (videos.length === 0) return 0;

  const videoIds = videos.map((v) => v.videoId);
  const details = await getVideoDetails(videoIds);

  // Check which videos we already have
  const existing = await db
    .select({ youtubeVideoId: meetingVideos.youtubeVideoId })
    .from(meetingVideos)
    .where(inArray(meetingVideos.youtubeVideoId, videoIds));
  const existingIds = new Set(existing.map((e) => e.youtubeVideoId));

  const newVideos = details.filter((v) => !existingIds.has(v.videoId));
  if (newVideos.length === 0) return 0;

  // Load candidate events for matching (last 6 months window)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const candidateEvents = await db
    .select({
      eventId: events.id,
      eventName: events.eventName,
      startDateTime: events.startDateTime,
      categoryName: events.categoryName,
    })
    .from(events)
    .where(gte(events.startDateTime, sixMonthsAgo));

  const candidates: MatchCandidate[] = candidateEvents.map((e) => ({
    eventId: e.eventId,
    eventName: e.eventName,
    startDateTime: e.startDateTime,
    categoryName: e.categoryName ?? '',
  }));

  const matches = matchVideosToEvents(
    newVideos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
      thumbnailUrl: v.thumbnailUrl,
      description: v.description,
    })),
    candidates,
  );

  const matchMap = new Map(matches.map((m) => [m.videoId, m]));
  let inserted = 0;

  for (const video of newVideos) {
    const match = matchMap.get(video.videoId);
    const autoLinked = match && match.confidence >= AUTO_LINK_THRESHOLD;

    await db.insert(meetingVideos).values({
      eventId: autoLinked ? match.eventId : 0,
      youtubeVideoId: video.videoId,
      youtubeTitle: video.title,
      youtubePublishedAt: new Date(video.publishedAt),
      youtubeThumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      source: 'youtube',
      matchConfidence: match?.confidence ?? 0,
    }).onConflictDoNothing();

    inserted++;
  }

  return inserted;
}

/**
 * Step 2: Extract transcripts for videos that don't have one yet.
 * Processes up to `limit` videos per run.
 */
export async function extractPendingTranscripts(limit: number = 3): Promise<number> {
  // Find videos linked to events that don't have a transcript row yet
  const videosNeedingTranscript = await db
    .select({
      id: meetingVideos.id,
      eventId: meetingVideos.eventId,
      youtubeVideoId: meetingVideos.youtubeVideoId,
    })
    .from(meetingVideos)
    .leftJoin(meetingTranscripts, eq(meetingVideos.id, meetingTranscripts.videoId))
    .where(
      and(
        isNull(meetingTranscripts.id),
        // Only process videos that are linked to an event
        gte(meetingVideos.eventId, 1),
      ),
    )
    .limit(limit);

  let extracted = 0;

  for (const video of videosNeedingTranscript) {
    const transcript = await extractTranscript(video.youtubeVideoId);
    if (!transcript) {
      // Create a failed transcript record so we don't retry endlessly
      await db.insert(meetingTranscripts).values({
        videoId: video.id,
        eventId: video.eventId,
        status: 'failed',
        errorMessage: 'No transcript available from YouTube or CivicClerk',
      });
      continue;
    }

    await db.insert(meetingTranscripts).values({
      videoId: video.id,
      eventId: video.eventId,
      rawTranscript: transcript.fullText,
      status: 'pending',
    });

    extracted++;
  }

  return extracted;
}

/**
 * Step 3: Run AI processing on pending transcripts.
 * Processes up to `limit` transcripts per run.
 */
export async function processPendingTranscripts(limit: number = 2): Promise<number> {
  const pending = await db
    .select()
    .from(meetingTranscripts)
    .where(eq(meetingTranscripts.status, 'pending'))
    .limit(limit);

  let processed = 0;

  for (const transcript of pending) {
    if (!transcript.rawTranscript) continue;

    // Mark as processing
    await db
      .update(meetingTranscripts)
      .set({ status: 'processing' })
      .where(eq(meetingTranscripts.id, transcript.id));

    try {
      const result = await processTranscript(transcript.rawTranscript);

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
        .where(eq(meetingTranscripts.id, transcript.id));

      processed++;
    } catch (err) {
      await db
        .update(meetingTranscripts)
        .set({
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        })
        .where(eq(meetingTranscripts.id, transcript.id));
    }
  }

  return processed;
}

/**
 * Run the full pipeline end-to-end.
 */
export async function runTranscriptPipeline(options?: {
  publishedAfter?: string;
  extractLimit?: number;
  processLimit?: number;
}): Promise<PipelineResult> {
  const errors: string[] = [];
  let videosDiscovered = 0;
  let videosMatched = 0;
  let transcriptsExtracted = 0;
  let transcriptsProcessed = 0;

  // Step 1: Discover
  try {
    videosDiscovered = await discoverNewVideos(options?.publishedAfter);
    // Count how many were auto-matched (eventId > 0)
    if (videosDiscovered > 0) {
      const matched = await db
        .select({ id: meetingVideos.id })
        .from(meetingVideos)
        .where(gte(meetingVideos.eventId, 1));
      videosMatched = matched.length;
    }
  } catch (err) {
    errors.push(`Discovery: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Step 2: Extract transcripts
  try {
    transcriptsExtracted = await extractPendingTranscripts(options?.extractLimit ?? 3);
  } catch (err) {
    errors.push(`Extraction: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Step 3: AI processing
  try {
    if (process.env.OPENROUTER_API_KEY) {
      transcriptsProcessed = await processPendingTranscripts(options?.processLimit ?? 2);
    }
  } catch (err) {
    errors.push(`Processing: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return { videosDiscovered, videosMatched, transcriptsExtracted, transcriptsProcessed, errors };
}
