import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, events, agendaSummaries, meetingTranscripts } from '@/lib/db';
import {
  generateDigestFromAgendaSummaries,
  generateDigestFromTranscriptSummary,
  saveDigest,
} from '@/lib/llm/digest';
import type { AgendaItemSummary } from '@/lib/llm/agenda-summary';
import type { TranscriptSummary } from '@/lib/youtube/ai-processor';

export const maxDuration = 300;

/**
 * POST /api/admin/backfill-digests
 * Generate digests for all meetings that have AI summaries but no digest yet.
 * Protected by CRON_SECRET. Pass ?limit=N to control batch size (default 20).
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 503 });
  }

  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20,
    100,
  );

  const results = { fromTranscript: 0, fromAgenda: 0, errors: 0, skipped: 0 };

  // Priority 1: Events with completed transcripts but no digest
  const transcriptRows = await db.execute(sql`
    SELECT e.id AS event_id, mt.summary_json
    FROM events e
    JOIN meeting_transcripts mt ON mt.event_id = e.id
    WHERE e.digest IS NULL
      AND mt.status = 'completed'
      AND mt.summary_json IS NOT NULL
    ORDER BY e.start_date_time DESC
    LIMIT ${limit}
  `);

  const processedEventIds = new Set<number>();

  for (const row of transcriptRows.rows as Array<{ event_id: number; summary_json: string }>) {
    try {
      const summary: TranscriptSummary = JSON.parse(row.summary_json);
      if (!summary.executiveSummary) {
        results.skipped++;
        continue;
      }
      const digest = await generateDigestFromTranscriptSummary(summary);
      if (digest) {
        await saveDigest(row.event_id, digest);
        results.fromTranscript++;
      }
      processedEventIds.add(row.event_id);
    } catch {
      results.errors++;
    }
  }

  // Priority 2: Events with agenda summaries but no digest (and not already processed above)
  const remaining = limit - processedEventIds.size;
  if (remaining > 0) {
    const agendaRows = await db.execute(sql`
      SELECT e.id AS event_id, e.start_date_time, a.summary_json
      FROM events e
      JOIN agenda_summaries a ON a.event_id = e.id
      WHERE e.digest IS NULL
      ORDER BY e.start_date_time DESC
      LIMIT ${remaining}
    `);

    for (const row of agendaRows.rows as Array<{ event_id: number; start_date_time: string; summary_json: string }>) {
      if (processedEventIds.has(row.event_id)) continue;
      try {
        const summaries: AgendaItemSummary[] = JSON.parse(row.summary_json);
        if (!summaries.length) {
          results.skipped++;
          continue;
        }
        const meetingDate = row.start_date_time ? new Date(row.start_date_time) : undefined;
        const digest = await generateDigestFromAgendaSummaries(summaries, meetingDate);
        if (digest) {
          await saveDigest(row.event_id, digest);
          results.fromAgenda++;
        }
      } catch {
        results.errors++;
      }
    }
  }

  return NextResponse.json({
    message: 'Backfill complete',
    ...results,
    total: results.fromTranscript + results.fromAgenda,
  });
}
