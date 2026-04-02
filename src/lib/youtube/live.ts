/**
 * Check if the City of Santa Fe YouTube channel is currently live-streaming.
 * Uses YouTube Data API v3 search.list with eventType=live.
 *
 * Server-side only — includes in-memory cache to avoid burning API quota
 * (search.list costs 100 units per call, daily limit is 10,000).
 */

import { gte } from 'drizzle-orm';
import { db, events } from '@/lib/db';
import { matchVideosToEvents, type MatchCandidate } from './matcher';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface LiveStreamResult {
  isLive: boolean;
  videoId?: string;
  title?: string;
  thumbnailUrl?: string;
  eventId?: number;
  matchConfidence?: number;
}

interface SearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    publishedAt: string;
    description: string;
    thumbnails: {
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface SearchResponse {
  items?: SearchItem[];
  pageInfo?: { totalResults: number };
}

// In-memory cache: avoids hitting YouTube on every request
let cachedResult: LiveStreamResult | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

function getApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null;
}

function getChannelId(): string {
  return process.env.YOUTUBE_CHANNEL_ID || 'UCTgU_rclEQSW7XN-sgaCUBA';
}

/**
 * Check if the channel has an active live stream and attempt to match
 * it to a CivicClerk event.
 */
export async function checkLiveStream(): Promise<LiveStreamResult> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    const result: LiveStreamResult = { isLive: false };
    cachedResult = result;
    cachedAt = now;
    return result;
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      channelId: getChannelId(),
      part: 'snippet',
      type: 'video',
      eventType: 'live',
      maxResults: '5',
    });

    const response = await fetch(`${YT_API_BASE}/search?${params}`);
    if (!response.ok) {
      console.error(`YouTube live check failed (${response.status})`);
      const result: LiveStreamResult = { isLive: false };
      cachedResult = result;
      cachedAt = now;
      return result;
    }

    const data: SearchResponse = await response.json();
    if (!data.items || data.items.length === 0) {
      const result: LiveStreamResult = { isLive: false };
      cachedResult = result;
      cachedAt = now;
      return result;
    }

    const liveVideo = data.items[0];
    const videoId = liveVideo.id.videoId;
    const title = liveVideo.snippet.title;
    const thumbnailUrl =
      liveVideo.snippet.thumbnails.medium?.url ||
      liveVideo.snippet.thumbnails.default?.url ||
      '';

    // Try to match to a CivicClerk event
    const matchWindowStart = new Date();
    matchWindowStart.setDate(matchWindowStart.getDate() - 7);
    const candidateEvents = await db
      .select({
        eventId: events.id,
        eventName: events.eventName,
        startDateTime: events.startDateTime,
        categoryName: events.categoryName,
      })
      .from(events)
      .where(gte(events.startDateTime, matchWindowStart));

    const candidates: MatchCandidate[] = candidateEvents.map((e) => ({
      eventId: e.eventId,
      eventName: e.eventName,
      startDateTime: e.startDateTime,
      categoryName: e.categoryName ?? '',
    }));

    const matches = matchVideosToEvents(
      [{
        videoId,
        title,
        publishedAt: liveVideo.snippet.publishedAt,
        thumbnailUrl,
        description: liveVideo.snippet.description,
      }],
      candidates,
    );

    const bestMatch = matches[0];

    const result: LiveStreamResult = {
      isLive: true,
      videoId,
      title,
      thumbnailUrl,
      eventId: bestMatch?.eventId,
      matchConfidence: bestMatch?.confidence,
    };

    cachedResult = result;
    cachedAt = now;
    return result;
  } catch (err) {
    console.error('YouTube live check error:', err);
    const result: LiveStreamResult = { isLive: false };
    cachedResult = result;
    cachedAt = now;
    return result;
  }
}
