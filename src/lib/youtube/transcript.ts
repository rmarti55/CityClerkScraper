/**
 * Transcript extraction from YouTube videos and CivicClerk media.
 * Primary: youtube-transcript package (no API key, scrapes captions).
 * Fallback: CivicClerk EventsMedia transcriptionUrl / closedCaptionUrl.
 */

import { fetchTranscript as ytFetchTranscript, type TranscriptResponse } from 'youtube-transcript';

export interface TranscriptSegment {
  text: string;
  offset: number;  // milliseconds
  duration: number; // milliseconds
}

export interface ExtractedTranscript {
  segments: TranscriptSegment[];
  fullText: string;
  source: 'youtube' | 'civicclerk';
}

/**
 * Format milliseconds offset to HH:MM:SS for display.
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Extract transcript from a YouTube video using auto-generated captions.
 */
export async function extractYouTubeTranscript(videoId: string): Promise<ExtractedTranscript | null> {
  try {
    const raw: TranscriptResponse[] = await ytFetchTranscript(videoId, { lang: 'en' });
    if (!raw || raw.length === 0) return null;

    const segments: TranscriptSegment[] = raw.map((r) => ({
      text: r.text,
      offset: r.offset,
      duration: r.duration,
    }));

    const fullText = segments.map((s) => s.text).join(' ');

    return { segments, fullText, source: 'youtube' };
  } catch {
    return null;
  }
}

/**
 * Fetch transcript from a CivicClerk transcription/caption URL.
 * These are typically plain text or VTT/SRT files.
 */
export async function extractCivicClerkTranscript(transcriptionUrl: string): Promise<ExtractedTranscript | null> {
  try {
    const response = await fetch(transcriptionUrl);
    if (!response.ok) return null;

    const text = await response.text();
    if (!text.trim()) return null;

    const segments = parseVttOrPlainText(text);
    const fullText = segments.map((s) => s.text).join(' ');

    return { segments, fullText, source: 'civicclerk' };
  } catch {
    return null;
  }
}

/**
 * Try YouTube first, then CivicClerk URLs as fallback.
 */
export async function extractTranscript(
  youtubeVideoId: string | null,
  civicClerkUrls?: { transcriptionUrl?: string; closedCaptionUrl?: string },
): Promise<ExtractedTranscript | null> {
  if (youtubeVideoId) {
    const yt = await extractYouTubeTranscript(youtubeVideoId);
    if (yt) return yt;
  }

  if (civicClerkUrls?.transcriptionUrl) {
    const cc = await extractCivicClerkTranscript(civicClerkUrls.transcriptionUrl);
    if (cc) return cc;
  }

  if (civicClerkUrls?.closedCaptionUrl) {
    const cc = await extractCivicClerkTranscript(civicClerkUrls.closedCaptionUrl);
    if (cc) return cc;
  }

  return null;
}

/**
 * Parse VTT/SRT formatted text into segments, or treat as plain text.
 */
function parseVttOrPlainText(text: string): TranscriptSegment[] {
  // Detect WebVTT
  if (text.startsWith('WEBVTT') || text.includes(' --> ')) {
    return parseVtt(text);
  }
  // Plain text fallback — single segment
  return [{ text: text.trim(), offset: 0, duration: 0 }];
}

function parseVtt(vtt: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = vtt.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const timeMatch = line.match(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/,
    );

    if (timeMatch) {
      const startMs =
        parseInt(timeMatch[1]) * 3600000 +
        parseInt(timeMatch[2]) * 60000 +
        parseInt(timeMatch[3]) * 1000 +
        parseInt(timeMatch[4]);
      const endMs =
        parseInt(timeMatch[5]) * 3600000 +
        parseInt(timeMatch[6]) * 60000 +
        parseInt(timeMatch[7]) * 1000 +
        parseInt(timeMatch[8]);

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        segments.push({
          text: textLines.join(' '),
          offset: startMs,
          duration: endMs - startMs,
        });
      }
    } else {
      i++;
    }
  }

  return segments;
}
