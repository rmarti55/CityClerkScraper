const ZOOM_RE = /zoom\.us\//i;
const TEAMS_RE = /teams\.microsoft\.com\//i;
const MEET_RE = /meet\.google\.com\//i;

/**
 * Detect the meeting platform from a URL.
 * Client-safe (no fs/node dependencies).
 */
export function getMeetingPlatform(url: string): string {
  if (ZOOM_RE.test(url)) return "Zoom";
  if (TEAMS_RE.test(url)) return "Teams";
  if (MEET_RE.test(url)) return "Google Meet";
  return "Virtual Meeting";
}
