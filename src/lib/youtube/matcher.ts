/**
 * Multi-layer matching of YouTube video titles to CivicClerk events.
 *
 * Layer 1: Committee alias table — deterministic lookup of known committee
 *          name variations (abbreviations, typos, ampersands) observed on
 *          the @cityofsantafe YouTube channel.
 * Layer 2: Fuzzy matching — bigram similarity + word-overlap (Jaccard)
 *          with improved normalization as a fallback.
 * Layer 3: Relaxed threshold — exact-date matches need less name confidence.
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

// ---------------------------------------------------------------------------
// Committee Alias Table
//
// Maps normalized name fragments to a canonical key. Built from a full audit
// of the @cityofsantafe YouTube channel (7+ months of titles). When the
// uploader uses a new variation, add a single line here — no logic changes.
// ---------------------------------------------------------------------------

const COMMITTEE_CANON: Record<string, string> = {
  // Public Works and Utilities Committee
  'public works and utilities': 'public_works_utilities',
  'public works utilities': 'public_works_utilities',
  'public works utilities committe': 'public_works_utilities',
  'pwuc': 'public_works_utilities',

  // Historic Districts Review Board
  'historic districts review': 'historic_review_board',
  'historic review': 'historic_review_board',
  'historic': 'historic_review_board',
  'hboard': 'historic_review_board',
  'h board': 'historic_review_board',

  // Governing Body
  'governing body': 'governing_body',

  // Bicycle and Pedestrian Advisory Committee
  'bicycle and pedestrian advisory': 'bicycle_pedestrian',
  'bicycle and pedestrian': 'bicycle_pedestrian',
  'bicycling and pedestrian advisory': 'bicycle_pedestrian',
  'bicycling and pedestrian': 'bicycle_pedestrian',
  'bpac': 'bicycle_pedestrian',

  // Buckman Direct Diversion Board
  'buckman direct diversion': 'buckman_diversion',
  'bdd': 'buckman_diversion',

  // Finance Committee
  'finance': 'finance',

  // Quality of Life Committee
  'quality of life': 'quality_of_life',

  // Planning Commission
  'planning commission': 'planning_commission',

  // Board of Adjustments
  'board of adjustments': 'board_of_adjustments',

  // Ethics and Campaign Review Board
  'ethics and campaign review': 'ethics_campaign_review',

  // Public Safety Committee
  'public safety': 'public_safety',
};

// Sorted by descending key length so longest match wins during lookup
const CANON_ENTRIES = Object.entries(COMMITTEE_CANON)
  .sort((a, b) => b[0].length - a[0].length);

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const TYPO_CORRECTIONS: [RegExp, string][] = [
  [/\bcommitte\b/gi, 'committee'],
  [/\bcomittee\b/gi, 'committee'],
  [/\butilites\b/gi, 'utilities'],
  [/\bbicycling\b/gi, 'bicycle'],
];

/**
 * Normalize a string for comparison:
 * - lowercase
 * - & → and
 * - fix known typos
 * - strip punctuation (except hyphens between letters for H-Board)
 * - collapse whitespace
 */
function normalize(s: string): string {
  let r = s.toLowerCase();
  r = r.replace(/&/g, ' and ');
  for (const [pattern, fix] of TYPO_CORRECTIONS) {
    r = r.replace(pattern, fix);
  }
  r = r.replace(/(?<=[a-z])-(?=[a-z])/g, ' ');
  r = r.replace(/[^\w\s]/g, ' ');
  r = r.replace(/\s+/g, ' ').trim();
  return r;
}

const STRIPPABLE_WORDS = /\b(regular|special|emergency|committee|joint|ad\s*hoc|subcommittee|meeting|meetings|session|hearing|hearings|board|public|live)\b/gi;

/**
 * Strip noise words that vary between YouTube titles and CivicClerk names
 * but don't affect the core committee identity.
 */
function stripNoise(s: string): string {
  return s.replace(STRIPPABLE_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a name to its canonical committee key via the alias table.
 * Tries the full stripped name, then progressively shorter word prefixes.
 * Returns null if no alias matches.
 */
function canonicalize(raw: string): string | null {
  const normed = stripNoise(normalize(raw));
  if (!normed) return null;

  // Direct lookup first (covers exact and long-form matches)
  for (const [alias, canon] of CANON_ENTRIES) {
    if (normed === alias || normed.startsWith(alias + ' ') || normed.endsWith(' ' + alias)) {
      return canon;
    }
  }

  // Try progressive word trimming from the right
  const words = normed.split(' ');
  for (let len = words.length - 1; len >= 1; len--) {
    const prefix = words.slice(0, len).join(' ');
    for (const [alias, canon] of CANON_ENTRIES) {
      if (prefix === alias) return canon;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Similarity Scorers
// ---------------------------------------------------------------------------

/**
 * Bigram overlap (Dice coefficient). Returns 0-1.
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
 * Word-level Jaccard similarity. More resilient to missing articles
 * and word-order differences than bigrams.
 */
function wordJaccard(a: string, b: string): number {
  const wa = new Set(normalize(a).split(' ').filter(Boolean));
  const wb = new Set(normalize(b).split(' ').filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;

  let intersection = 0;
  for (const w of wa) {
    if (wb.has(w)) intersection++;
  }

  const union = new Set([...wa, ...wb]).size;
  return intersection / union;
}

// ---------------------------------------------------------------------------
// Date Extraction
// ---------------------------------------------------------------------------

/**
 * Extract a date from a YouTube video title. Handles:
 *   "March 18, 2026", "03/18/2026", "3-18-2026", "03-16-26", "2026-03-18"
 */
function extractDateFromTitle(title: string): DateTime | null {
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

  const slashDate = title.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (slashDate) {
    const dt = DateTime.fromObject(
      { month: parseInt(slashDate[1]), day: parseInt(slashDate[2]), year: parseInt(slashDate[3]) },
      { zone: 'America/Denver' },
    );
    if (dt.isValid) return dt;
  }

  const shortYearDate = title.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2})\b/);
  if (shortYearDate) {
    const year = 2000 + parseInt(shortYearDate[3]);
    const dt = DateTime.fromObject(
      { month: parseInt(shortYearDate[1]), day: parseInt(shortYearDate[2]), year },
      { zone: 'America/Denver' },
    );
    if (dt.isValid) return dt;
  }

  const isoDate = title.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    const dt = DateTime.fromISO(`${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`, { zone: 'America/Denver' });
    if (dt.isValid) return dt;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Meeting Name Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the meeting name from a YouTube title by stripping dates,
 * multi-part suffixes, and trailing separators.
 */
function extractMeetingName(title: string): string {
  let name = title
    // Date patterns
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}\b/i, '')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/, '')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2}\b/, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/, '')
    // Multi-part suffixes: "Part 1/3", "Part1/2", "Part 2 of 3"
    .replace(/\s*:?\s*part\s*\d+\s*[/]\s*\d+/i, '')
    .replace(/\s*:?\s*part\s*\d+\s*of\s*\d+/i, '')
    // Trailing/leading separators
    .replace(/\s*[-–—|:]\s*$/, '')
    .replace(/^\s*[-–—|:]\s*/, '')
    .trim();

  return name || title;
}

// ---------------------------------------------------------------------------
// Main Matching
// ---------------------------------------------------------------------------

/**
 * Match a batch of YouTube videos against CivicClerk events.
 *
 * Scoring:
 *   dateScore  (0-50): exact day = 50, ±1 day = 30, same week = 10
 *   nameScore  (0-50): alias match = 50, else max(bigram, Jaccard, stripped) * 50
 *   confidence = dateScore + nameScore
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

    const videoCanon = canonicalize(titleName);

    let bestMatch: MatchResult | null = null;

    for (const event of events) {
      const eventDate = DateTime.fromJSDate(event.startDateTime, { zone: 'America/Denver' });

      // --- Date scoring ---
      let dateScore = 0;
      if (titleDate) {
        const dayDiff = Math.abs(titleDate.diff(eventDate, 'days').days);
        if (dayDiff < 1) dateScore = 50;
        else if (dayDiff < 2) dateScore = 30;
        else if (dayDiff < 7) dateScore = 10;
      } else {
        const dayDiff = Math.abs(videoPublished.diff(eventDate, 'days').days);
        if (dayDiff < 2) dateScore = 20;
        else if (dayDiff < 7) dateScore = 5;
      }

      if (dateScore === 0) continue;

      // --- Name scoring ---
      let nameScore = 0;

      // Layer 1: Alias-based deterministic match
      const eventCanon = canonicalize(event.eventName)
        ?? canonicalize(event.categoryName);

      if (videoCanon && eventCanon && videoCanon === eventCanon) {
        nameScore = 50;
      } else {
        // Layer 2: Fuzzy fallback — best of bigram, Jaccard, and stripped variants
        const simBigram = bigramSimilarity(titleName, event.eventName);
        const simCategory = bigramSimilarity(titleName, event.categoryName);
        const simStripped = bigramSimilarity(
          stripNoise(titleName),
          stripNoise(event.eventName),
        );
        const simJaccard = wordJaccard(titleName, event.eventName);
        const simJaccardStripped = wordJaccard(
          stripNoise(titleName),
          stripNoise(event.eventName),
        );

        const bestSim = Math.max(
          simBigram,
          simCategory,
          simStripped,
          simJaccard,
          simJaccardStripped,
        );
        nameScore = Math.round(bestSim * 50);
      }

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
 * Auto-link threshold. When the date is an exact match (dateScore 50),
 * we need less name confidence since same-day + partial-name is strong signal.
 */
export const AUTO_LINK_THRESHOLD = 80;
export const AUTO_LINK_THRESHOLD_EXACT_DATE = 70;

/**
 * Determine effective threshold based on the match's date score.
 */
export function getAutoLinkThreshold(dateScore: number): number {
  return dateScore >= 50 ? AUTO_LINK_THRESHOLD_EXACT_DATE : AUTO_LINK_THRESHOLD;
}
