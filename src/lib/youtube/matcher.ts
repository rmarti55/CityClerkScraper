/**
 * Fuzzy matching of YouTube video titles to CivicClerk events.
 *
 * YouTube titles from City of Santa Fe typically look like:
 *   "Governing Body Meeting - March 18, 2026"
 *   "Planning Commission - March 20, 2026"
 *   "Public Utilities Committee Meeting - 03/15/2026"
 *
 * We parse the title for a meeting name and date, then match against
 * events.eventName + events.startDateTime within a +/-1 day window.
 */

import { DateTime } from 'luxon';
import type { YouTubeVideo } from './channel';

export interface MatchCandidate {
  eventId: number;
  eventName: string;
  startDateTime: Date;
  categoryName: string;
}

export interface MatchResult {
  videoId: string;
  videoTitle: string;
  eventId: number;
  confidence: number; // 0-100
  nameScore: number;
  dateScore: number;
}

/**
 * Normalize a string for comparison: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute similarity between two strings using bigram overlap (Dice coefficient).
 * Returns 0-1 where 1 is identical.
 */
function bigramSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < na.length - 1; i++) bigramsA.add(na.slice(i, i + 2));

  const bigramsB = new Set<string>();
  for (let i = 0; i < nb.length - 1; i++) bigramsB.add(nb.slice(i, i + 2));

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Try to extract a date from a YouTube video title.
 * Handles formats like:
 *   "March 18, 2026"
 *   "03/18/2026"
 *   "3-18-2026"
 *   "2026-03-18"
 */
function extractDateFromTitle(title: string): DateTime | null {
  // "Month Day, Year" — e.g. "March 18, 2026"
  const longDate = title.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})\b/i,
  );
  if (longDate) {
    const dt = DateTime.fromFormat(
      `${longDate[1]} ${longDate[2]} ${longDate[3]}`,
      'MMMM d yyyy',
      { zone: 'America/Denver' },
    );
    if (dt.isValid) return dt;
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const slashDate = title.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (slashDate) {
    const dt = DateTime.fromObject(
      { month: parseInt(slashDate[1]), day: parseInt(slashDate[2]), year: parseInt(slashDate[3]) },
      { zone: 'America/Denver' },
    );
    if (dt.isValid) return dt;
  }

  // MM/DD/YY or MM-DD-YY (2-digit year, e.g. "03-16-26")
  const shortYearDate = title.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/);
  if (shortYearDate) {
    const year = 2000 + parseInt(shortYearDate[3]);
    const dt = DateTime.fromObject(
      { month: parseInt(shortYearDate[1]), day: parseInt(shortYearDate[2]), year },
      { zone: 'America/Denver' },
    );
    if (dt.isValid) return dt;
  }

  // ISO YYYY-MM-DD
  const isoDate = title.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    const dt = DateTime.fromISO(`${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`, { zone: 'America/Denver' });
    if (dt.isValid) return dt;
  }

  return null;
}

/**
 * Extract the meeting name portion from a YouTube title (before the date/separator).
 */
function extractMeetingName(title: string): string {
  // Strip date patterns and common separators
  let name = title
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}\b/i, '')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/, '')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2}\b/, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/, '')
    .replace(/\s*[-–—|]\s*$/, '')
    .replace(/^\s*[-–—|]\s*/, '')
    .trim();

  return name || title;
}

const NOISE_WORDS = /\b(regular|special|emergency|committee|joint|ad\s*hoc|subcommittee)\b/gi;

/**
 * Strip common qualifier words that differ between YouTube titles and CivicClerk
 * event names but don't affect the core meeting identity.
 * e.g. "Regular Governing Body Meeting" → "Governing Body Meeting"
 *      "Governing Body Committee Meeting" → "Governing Body Meeting"
 */
function stripNoiseWords(s: string): string {
  return s.replace(NOISE_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Match a batch of YouTube videos against a set of CivicClerk events.
 * Returns matches sorted by confidence (highest first).
 */
export function matchVideosToEvents(
  videos: YouTubeVideo[],
  events: MatchCandidate[],
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const video of videos) {
    const titleDate = extractDateFromTitle(video.title);
    const titleName = extractMeetingName(video.title);
    const videoPublished = DateTime.fromISO(video.publishedAt, { zone: 'America/Denver' });

    let bestMatch: MatchResult | null = null;

    for (const event of events) {
      const eventDate = DateTime.fromJSDate(event.startDateTime, { zone: 'America/Denver' });

      // Date scoring: exact day = 50, +/-1 day = 30, same week = 10, else 0
      let dateScore = 0;
      if (titleDate) {
        const dayDiff = Math.abs(titleDate.diff(eventDate, 'days').days);
        if (dayDiff < 1) dateScore = 50;
        else if (dayDiff < 2) dateScore = 30;
        else if (dayDiff < 7) dateScore = 10;
      } else {
        // No date in title — use publish date as weak signal
        const dayDiff = Math.abs(videoPublished.diff(eventDate, 'days').days);
        if (dayDiff < 2) dateScore = 20;
        else if (dayDiff < 7) dateScore = 5;
      }

      if (dateScore === 0) continue;

      // Name scoring: compare extracted meeting name against eventName, categoryName,
      // and a noise-word-stripped version of both for resilience to qualifier differences
      // like "Regular" vs "Committee".
      const nameSimEvent = bigramSimilarity(titleName, event.eventName);
      const nameSimCategory = bigramSimilarity(titleName, event.categoryName);
      const nameSimStripped = bigramSimilarity(
        stripNoiseWords(titleName),
        stripNoiseWords(event.eventName),
      );
      const nameSim = Math.max(nameSimEvent, nameSimCategory, nameSimStripped);
      const nameScore = Math.round(nameSim * 50);

      const confidence = dateScore + nameScore;

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          videoId: video.videoId,
          videoTitle: video.title,
          eventId: event.eventId,
          confidence,
          nameScore,
          dateScore,
        };
      }
    }

    if (bestMatch && bestMatch.confidence >= 30) {
      results.push(bestMatch);
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Auto-link threshold: matches at or above this confidence are linked automatically.
 * Below this, they're flagged for manual review.
 */
export const AUTO_LINK_THRESHOLD = 80;
