/**
 * AI processing pipeline for meeting transcripts.
 * Uses OpenRouter (same pattern as agenda-summary.ts) to:
 *   1. Clean raw transcript (fix speaker names, punctuation, filler words)
 *   2. Generate executive summary (key decisions, action items, public comments)
 *   3. Attribute speakers to segments
 *   4. Extract topics and keywords
 *
 * Transcripts are long (20k-40k words for 2-4 hour meetings), so we chunk
 * and use a map-reduce approach.
 */

import { chatCompletion } from '@/lib/llm/openrouter';

const CHUNK_SIZE = 12000; // ~3000 tokens worth of text per chunk
const FAST_MODEL = 'anthropic/claude-haiku-4.5';
const SMART_MODEL = 'anthropic/claude-sonnet-4.6';

export interface TranscriptSummary {
  executiveSummary: string;
  keyDecisions: string[];
  actionItems: string[];
  publicCommentsSummary: string;
  motionsAndVotes: string[];
}

export interface SpeakerSegment {
  speaker: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface TopicTag {
  topic: string;
  keywords: string[];
  relevanceScore: number;
}

/**
 * Split text into chunks of roughly `size` characters, breaking at sentence boundaries.
 */
function chunkText(text: string, size: number = CHUNK_SIZE): string[] {
  if (text.length <= size) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + size;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // Find a sentence boundary near the chunk limit
    const searchWindow = text.slice(end - 200, end + 200);
    const sentenceEnd = searchWindow.search(/[.!?]\s/);
    if (sentenceEnd !== -1) {
      end = end - 200 + sentenceEnd + 2;
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

/**
 * Step 1: Clean the raw transcript text.
 * Fixes punctuation, removes filler words, normalizes speaker references.
 */
export async function cleanTranscript(rawText: string): Promise<string> {
  const chunks = chunkText(rawText);
  const cleanedChunks: string[] = [];

  for (const chunk of chunks) {
    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a transcript editor for government meeting recordings. Clean up this auto-generated caption text:
- Fix punctuation and capitalization
- Remove filler words (um, uh, like, you know) unless they change meaning
- Fix obvious transcription errors of proper nouns (city names, official titles)
- Preserve the original meaning exactly — do not add, remove, or change substantive content
- Keep speaker attributions if present (e.g. "Mayor:", "Chair:")
- Break into logical paragraphs at speaker changes or topic shifts
- Output ONLY the cleaned text, no commentary`,
        },
        { role: 'user', content: chunk },
      ],
      { model: FAST_MODEL, temperature: 0.1, maxTokens: 4096 },
    );
    cleanedChunks.push(result.content);
  }

  return cleanedChunks.join('\n\n');
}

/**
 * Step 2: Generate an executive summary using map-reduce.
 */
export async function generateSummary(cleanedText: string): Promise<TranscriptSummary> {
  const chunks = chunkText(cleanedText);

  // Map: summarize each chunk
  const chunkSummaries: string[] = [];
  for (const chunk of chunks) {
    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `Summarize this section of a government meeting transcript. Include:
- Key topics discussed
- Any decisions made or votes taken
- Action items assigned
- Notable public comments
Output a concise bullet-point summary (max 300 words).`,
        },
        { role: 'user', content: chunk },
      ],
      { model: FAST_MODEL, temperature: 0.2, maxTokens: 1024 },
    );
    chunkSummaries.push(result.content);
  }

  // Reduce: combine chunk summaries into final structured summary
  const combined = chunkSummaries.join('\n\n---\n\n');
  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `You are summarizing a city government meeting. Given section-by-section summaries, produce a final structured summary as JSON:

{
  "executiveSummary": "2-3 paragraph overview of the meeting for a resident who wasn't there",
  "keyDecisions": ["Decision 1", "Decision 2", ...],
  "actionItems": ["Action item 1 (assigned to whom, deadline if mentioned)", ...],
  "publicCommentsSummary": "Summary of themes from public comment period, or 'No public comment period' if none",
  "motionsAndVotes": ["Motion description — result (e.g. Passed 5-2)", ...]
}

Rules:
- Use plain language, no jargon
- Be specific about who said/did what
- Include vote counts when available
- Output ONLY valid JSON, no markdown fences`,
      },
      { role: 'user', content: combined },
    ],
    { model: SMART_MODEL, temperature: 0.2, maxTokens: 2048 },
  );

  try {
    return JSON.parse(result.content);
  } catch {
    return {
      executiveSummary: result.content,
      keyDecisions: [],
      actionItems: [],
      publicCommentsSummary: '',
      motionsAndVotes: [],
    };
  }
}

/**
 * Step 3: Identify speakers and attribute segments.
 * Two-pass approach: first identify speakers, then attribute.
 */
export async function attributeSpeakers(cleanedText: string): Promise<SpeakerSegment[]> {
  // Pass 1: Identify all speakers mentioned
  const identifyResult = await chatCompletion(
    [
      {
        role: 'system',
        content: `Analyze this government meeting transcript and list every distinct speaker you can identify.
For each speaker, provide their name and role if apparent (e.g. "Mayor Alan Webber", "Councilor Carol Romero-Wirth", "City Manager", "Public commenter").
Output as a JSON array of objects: [{"name": "...", "role": "..."}]
Output ONLY valid JSON, no markdown fences.`,
      },
      { role: 'user', content: cleanedText.slice(0, CHUNK_SIZE * 3) },
    ],
    { model: SMART_MODEL, temperature: 0.1, maxTokens: 1024 },
  );

  let speakers: Array<{ name: string; role: string }> = [];
  try {
    speakers = JSON.parse(identifyResult.content);
  } catch {
    speakers = [];
  }

  // Pass 2: Attribute text segments to speakers
  const chunks = chunkText(cleanedText);
  const allSegments: SpeakerSegment[] = [];
  let charOffset = 0;

  for (const chunk of chunks) {
    const speakerList = speakers.map((s) => `${s.name} (${s.role})`).join(', ');
    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `Given this section of a meeting transcript and the known speakers: ${speakerList}

Attribute each paragraph or speaking turn to a speaker. Output as a JSON array:
[{"speaker": "Speaker Name", "text": "What they said..."}]

Rules:
- Use the speaker's full name when known
- Use "Unknown Speaker" if you can't determine who is speaking
- Use "Public Commenter" or "Public Commenter (Name)" for public comment
- Combine consecutive sentences by the same speaker into one segment
- Output ONLY valid JSON, no markdown fences`,
        },
        { role: 'user', content: chunk },
      ],
      { model: FAST_MODEL, temperature: 0.1, maxTokens: 4096 },
    );

    try {
      const segments: Array<{ speaker: string; text: string }> = JSON.parse(result.content);
      for (const seg of segments) {
        const startOffset = charOffset;
        charOffset += seg.text.length + 1;
        allSegments.push({
          speaker: seg.speaker,
          startOffset,
          endOffset: charOffset,
          text: seg.text,
        });
      }
    } catch {
      allSegments.push({
        speaker: 'Unknown',
        startOffset: charOffset,
        endOffset: charOffset + chunk.length,
        text: chunk,
      });
      charOffset += chunk.length;
    }
  }

  return allSegments;
}

/**
 * Step 4: Extract topics and keywords from the transcript.
 */
export async function extractTopics(cleanedText: string): Promise<TopicTag[]> {
  // Use a representative sample if the text is very long
  const sample = cleanedText.length > CHUNK_SIZE * 2
    ? cleanedText.slice(0, CHUNK_SIZE) + '\n...\n' + cleanedText.slice(-CHUNK_SIZE)
    : cleanedText;

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `Analyze this government meeting transcript and extract the main topics discussed.
For each topic, provide:
- topic: A short label (2-5 words)
- keywords: 3-5 related keywords that appear in the transcript
- relevanceScore: 0-100 indicating how much of the meeting focused on this topic

Output as a JSON array sorted by relevanceScore descending:
[{"topic": "...", "keywords": ["...", "..."], "relevanceScore": 85}]

Rules:
- Extract 5-15 topics
- Be specific (e.g. "Water Rate Increase" not "Utilities")
- Include both policy topics and procedural items
- Output ONLY valid JSON, no markdown fences`,
      },
      { role: 'user', content: sample },
    ],
    { model: SMART_MODEL, temperature: 0.2, maxTokens: 1024 },
  );

  try {
    return JSON.parse(result.content);
  } catch {
    return [];
  }
}

/**
 * Run the full AI processing pipeline on a raw transcript.
 * Returns all processed outputs.
 */
export async function processTranscript(rawText: string): Promise<{
  cleanedTranscript: string;
  summary: TranscriptSummary;
  speakers: SpeakerSegment[];
  topics: TopicTag[];
  model: string;
}> {
  const cleanedTranscript = await cleanTranscript(rawText);
  const [summary, speakers, topics] = await Promise.all([
    generateSummary(cleanedTranscript),
    attributeSpeakers(cleanedTranscript),
    extractTopics(cleanedTranscript),
  ]);

  return {
    cleanedTranscript,
    summary,
    speakers,
    topics,
    model: SMART_MODEL,
  };
}
