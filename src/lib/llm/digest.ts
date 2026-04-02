/**
 * One-sentence meeting digest generation.
 *
 * Distills existing AI summaries (agenda or transcript) into a single
 * sentence for display on meeting cards. Designed for minimal token usage:
 * ~100-200 input tokens, ~30 output tokens per call.
 */

import { chatCompletion } from './openrouter';
import { FAST_MODEL } from './models';
import { db, events } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { AgendaItemSummary } from './agenda-summary';
import type { TranscriptSummary } from '@/lib/youtube/ai-processor';

const DIGEST_PROMPT = `Compress the following government meeting summary into exactly one sentence, max 120 characters. Focus on the most impactful topic for residents. Plain language, no jargon. Output ONLY the sentence, nothing else.`;

/**
 * Generate a one-sentence digest from arbitrary summary text.
 */
export async function generateDigest(summaryText: string): Promise<string> {
  const result = await chatCompletion(
    [
      { role: 'system', content: DIGEST_PROMPT },
      { role: 'user', content: summaryText.slice(0, 800) },
    ],
    { model: FAST_MODEL, temperature: 0.1, maxTokens: 60 },
  );

  return result.content.trim().replace(/^["']|["']$/g, '');
}

/**
 * Generate a digest from per-item agenda summaries.
 * Concatenates the headlines + details into a compact block.
 */
export async function generateDigestFromAgendaSummaries(
  summaries: AgendaItemSummary[],
): Promise<string> {
  if (summaries.length === 0) return '';

  const block = summaries
    .slice(0, 8)
    .map((s) => `${s.summary}: ${s.detail}`)
    .join('\n');

  return generateDigest(block);
}

/**
 * Generate a digest from a transcript executive summary.
 * The executiveSummary is already 2-3 paragraphs; we compress to one sentence.
 */
export async function generateDigestFromTranscriptSummary(
  summary: TranscriptSummary,
): Promise<string> {
  if (!summary.executiveSummary) return '';
  return generateDigest(summary.executiveSummary);
}

/**
 * Write a digest to the events table for a given event.
 */
export async function saveDigest(eventId: number, digest: string): Promise<void> {
  if (!digest) return;
  await db.update(events).set({ digest }).where(eq(events.id, eventId));
}
