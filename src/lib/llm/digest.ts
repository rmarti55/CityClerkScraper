/**
 * One-sentence meeting digest generation.
 *
 * Two modes based on whether the meeting has occurred:
 *   - Past: action-oriented ("Council approved...; sworn in...")
 *   - Future: agenda preview ("On the agenda: water rates, zoning, park renovation")
 *
 * Transcript digests always use past tense (transcripts only exist after a meeting).
 */

import { chatCompletion } from './openrouter';
import { FAST_MODEL } from './models';
import { db, events } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { AgendaItemSummary } from './agenda-summary';
import type { TranscriptSummary } from '@/lib/youtube/ai-processor';

const PAST_DIGEST_PROMPT = `Write a 1-2 sentence summary (max 200 characters) of this government meeting for a resident scanning a list of meetings.

Rules:
- Name specific actions: who was appointed, what was approved, what dollar amounts, what vote counts
- Use semicolons to pack in multiple key items
- NEVER use vague words like "discussed", "addressed", "considered", "reviewed", or "focused on"
- NEVER describe the meeting process — only state what happened or was decided
- If no decisions were made, name the 2-3 most specific topics with concrete details
- Output ONLY the summary text, nothing else`;

const FUTURE_DIGEST_PROMPT = `Write a 1-sentence preview (max 200 characters) of an upcoming government meeting's agenda for a resident scanning a list of meetings.

Rules:
- Start with "On the agenda:" or "Topics include"
- List 2-4 specific agenda topics using semicolons
- Use present tense — this meeting has NOT happened yet
- Be specific: name ordinances, dollar amounts, project names, applicants
- NEVER use past tense — nothing has been approved, decided, or voted on
- Output ONLY the preview text, nothing else`;

/**
 * Generate a digest from summary text.
 * @param tense 'past' for meetings that already occurred, 'future' for upcoming
 */
export async function generateDigest(
  summaryText: string,
  tense: 'past' | 'future' = 'past',
): Promise<string> {
  const prompt = tense === 'future' ? FUTURE_DIGEST_PROMPT : PAST_DIGEST_PROMPT;
  const result = await chatCompletion(
    [
      { role: 'system', content: prompt },
      { role: 'user', content: summaryText.slice(0, 1200) },
    ],
    { model: FAST_MODEL, temperature: 0.1, maxTokens: 100 },
  );

  return result.content.trim().replace(/^["']|["']$/g, '');
}

/**
 * Generate a digest from per-item agenda summaries.
 * Uses future tense if the meeting hasn't occurred yet.
 */
export async function generateDigestFromAgendaSummaries(
  summaries: AgendaItemSummary[],
  meetingDate?: Date,
): Promise<string> {
  if (summaries.length === 0) return '';

  const tense = meetingDate && meetingDate > new Date() ? 'future' : 'past';

  const block = summaries
    .slice(0, 10)
    .map((s) => `${s.summary}: ${s.detail}`)
    .join('\n');

  return generateDigest(block, tense);
}

/**
 * Generate a digest from a transcript summary.
 * Always past tense -- transcripts only exist after a meeting.
 */
export async function generateDigestFromTranscriptSummary(
  summary: TranscriptSummary,
): Promise<string> {
  if (!summary.executiveSummary) return '';

  const parts: string[] = [summary.executiveSummary];

  if (summary.keyDecisions?.length) {
    parts.push('Key decisions: ' + summary.keyDecisions.join('; '));
  }
  if (summary.motionsAndVotes?.length) {
    parts.push('Votes: ' + summary.motionsAndVotes.join('; '));
  }

  return generateDigest(parts.join('\n\n'), 'past');
}

/**
 * Write a digest to the events table for a given event.
 */
export async function saveDigest(eventId: number, digest: string): Promise<void> {
  if (!digest) return;
  await db.update(events).set({ digest }).where(eq(events.id, eventId));
}
