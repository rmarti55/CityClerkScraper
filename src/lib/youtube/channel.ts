/**
 * YouTube Data API v3 client for discovering City of Santa Fe meeting videos.
 * Uses raw fetch (no googleapis SDK) to keep the bundle small.
 */

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  description: string;
}

export interface YouTubeVideoDetails extends YouTubeVideo {
  duration: string; // ISO 8601 e.g. "PT2H15M"
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
  items: SearchItem[];
  nextPageToken?: string;
  pageInfo: { totalResults: number };
}

interface VideoItem {
  id: string;
  contentDetails: { duration: string };
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

interface VideosResponse {
  items: VideoItem[];
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY environment variable is not set');
  return key;
}

function getChannelId(): string {
  return process.env.YOUTUBE_CHANNEL_ID || 'UCpSHOBJ-o3VIq9a5sYJiMMA';
}

/**
 * List recent videos from the configured YouTube channel.
 * Returns up to `maxResults` videos published after `publishedAfter`.
 */
export async function listChannelVideos(options: {
  publishedAfter?: string; // ISO 8601 date
  maxResults?: number;
} = {}): Promise<YouTubeVideo[]> {
  const apiKey = getApiKey();
  const channelId = getChannelId();
  const maxResults = options.maxResults ?? 50;
  const allVideos: YouTubeVideo[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key: apiKey,
      channelId,
      part: 'snippet',
      type: 'video',
      order: 'date',
      maxResults: String(Math.min(maxResults - allVideos.length, 50)),
    });
    if (options.publishedAfter) {
      params.set('publishedAfter', options.publishedAfter);
    }
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`${YT_API_BASE}/search?${params}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`YouTube search API error (${response.status}): ${text}`);
    }

    const data: SearchResponse = await response.json();
    for (const item of data.items) {
      allVideos.push({
        videoId: item.id.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
        description: item.snippet.description,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && allVideos.length < maxResults);

  return allVideos;
}

/**
 * Fetch detailed info (including duration) for a batch of video IDs.
 * YouTube API allows up to 50 IDs per request.
 */
export async function getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
  if (videoIds.length === 0) return [];
  const apiKey = getApiKey();
  const results: YouTubeVideoDetails[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      key: apiKey,
      id: batch.join(','),
      part: 'snippet,contentDetails',
    });

    const response = await fetch(`${YT_API_BASE}/videos?${params}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`YouTube videos API error (${response.status}): ${text}`);
    }

    const data: VideosResponse = await response.json();
    for (const item of data.items) {
      results.push({
        videoId: item.id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
        description: item.snippet.description,
        duration: item.contentDetails.duration,
      });
    }
  }

  return results;
}
