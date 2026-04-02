/**
 * AI-powered agenda item summarization.
 *
 * Given a meeting's agenda items, generates a 3-5 word headline and one-sentence
 * detail for each substantive item. Results are served via the
 * /api/meeting/[id]/agenda-summary endpoint (cached 1h, SWR 2h).
 */

import { chatCompletion, type CompletionOptions } from './openrouter';
import { FAST_MODEL } from './models';
import type { MeetingItem } from '@/lib/types';
import { parseAgendaItem } from '@/lib/agenda-item-parser';
import { collectItemsWithAttachments } from '@/lib/agenda-items';

/** Single agenda item summary returned by the LLM. */
export interface AgendaItemSummary {
  itemId: number;
  outlineNumber: string;
  summary: string;
  detail: string;
}

const SYSTEM_PROMPT = `You are a concise government meeting summarizer. For each agenda item you receive, produce:
1. A "summary": 3-5 word headline that captures the core topic
2. A "detail": one plain-English sentence, 20 words max, explaining what the item is about

Rules:
- summary: exactly 3 to 5 words, no more
- detail: one sentence, max 20 words, giving useful context a resident would care about
- Use plain language — avoid jargon and legalese
- Focus on substance, not procedural framing
- Do not start summary with "Approval of" or "Request for"
- Output ONLY a JSON array of objects with "itemId", "outlineNumber", "summary", and "detail" fields
- Preserve the exact itemId and outlineNumber provided for each item
- No markdown, no explanation, just the JSON array`;

/**
 * Generate plain-language summaries for a meeting's agenda items.
 *
 * Filters to substantive items (those with attachments), sends them to
 * the configured FAST_MODEL, and parses the JSON response. Uses outlineNumber
 * as a fallback key when the LLM mangles itemId.
 *
 * @returns Parsed summaries, or `[]` on LLM/parse failure.
 */
export async function generateAgendaSummaries(
  items: MeetingItem[],
  options?: CompletionOptions,
): Promise<AgendaItemSummary[]> {
  const relevant = collectItemsWithAttachments(items);
  if (relevant.length === 0) return [];

  const itemDescriptions = relevant.map((item) => {
    const parsed = parseAgendaItem(
      item.agendaObjectItemName,
      item.agendaObjectItemOutlineNumber,
      item.agendaObjectItemDescription,
    );
    return {
      itemId: item.id,
      outlineNumber: parsed.outlineNumber,
      title: parsed.title,
      description: parsed.description?.slice(0, 500) ?? null,
    };
  });

  const userPrompt = `For each agenda item, provide a 3-5 word summary and a one-sentence detail (max 20 words):\n\n${JSON.stringify(itemDescriptions, null, 2)}`;

  const result = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.2,
      maxTokens: 4096,
      model: FAST_MODEL,
      ...options,
    },
  );

  // Build a lookup from outlineNumber -> itemId so we can recover the id
  // even if the LLM drops or mangles the itemId field.
  const idByOutline = new Map(
    itemDescriptions.map((d) => [d.outlineNumber, d.itemId]),
  );

  try {
    const parsed = JSON.parse(result.content);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          typeof item === 'object' &&
          item !== null &&
          'outlineNumber' in item &&
          'summary' in item &&
          'detail' in item,
      )
      .map((item) => {
        const outlineNumber = String(item.outlineNumber);
        const itemId = Number(item.itemId) || idByOutline.get(outlineNumber) || 0;
        return {
          itemId,
          outlineNumber,
          summary: String(item.summary),
          detail: String(item.detail),
        };
      });
  } catch (e) {
    console.warn('Failed to parse agenda summary LLM response:', e);
    return [];
  }
}
