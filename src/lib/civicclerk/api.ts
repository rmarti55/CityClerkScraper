import { DateTime } from 'luxon';
import type { CivicEvent, CivicFile, MeetingDetails } from '../types';
import type { EventsResponse, EventApiResponse, RawApiEvent } from './types';

export const API_BASE = "https://santafenm.api.civicclerk.com/v1";

export function getHeaders(): HeadersInit {
  return {
    Accept: "application/json",
  };
}

/** True if the date is in February 2026 (scope for Event+Meeting file merge). */
export function isFebruary2026(date: Date): boolean {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return y === 2026 && m === 1; // 0-indexed month
}

/**
 * Normalize API event to CivicEvent: use flat venue fields when present,
 * otherwise map from eventLocation (address1 -> venueName, address2 -> venueAddress, city/state/zipCode).
 */
export function normalizeApiEvent(raw: RawApiEvent): CivicEvent {
  let venueName = raw.venueName;
  let venueAddress = raw.venueAddress;
  let venueCity = raw.venueCity;
  let venueState = raw.venueState;
  let venueZip = raw.venueZip;

  const loc = raw.eventLocation;
  if (loc && (venueName == null && venueAddress == null && venueCity == null && venueState == null && venueZip == null)) {
    venueName = loc.address1 ?? undefined;
    venueAddress = loc.address2 ?? undefined;
    venueCity = loc.city ?? undefined;
    venueState = loc.state ?? undefined;
    venueZip = loc.zipCode ?? undefined;
  }

  return {
    id: raw.id,
    eventName: raw.eventName,
    eventDescription: raw.eventDescription ?? '',
    eventDate: raw.eventDate,
    startDateTime: raw.startDateTime,
    agendaId: raw.agendaId,
    agendaName: raw.agendaName ?? '',
    categoryName: raw.categoryName ?? '',
    isPublished: raw.isPublished ?? '',
    venueName: venueName || undefined,
    venueAddress: venueAddress || undefined,
    venueCity: venueCity || undefined,
    venueState: venueState || undefined,
    venueZip: venueZip || undefined,
    fileCount: raw.fileCount,
    fileNames: raw.fileNames,
  };
}

/** Fetch Event by id from API and return normalized publishedFiles (for February merge). */
export async function fetchEventPublishedFilesFromAPI(eventId: number): Promise<CivicFile[]> {
  const response = await fetch(`${API_BASE}/Events/${eventId}`, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });
  if (!response.ok) return [];
  const data: EventApiResponse = await response.json();
  const list = data.publishedFiles ?? [];
  return list.map((f) => ({
    fileId: f.fileId,
    name: f.name,
    type: f.type,
    url: f.url,
    publishOn: f.publishOn,
    fileType: f.fileType,
  }));
}

/** Merge meeting files and event files, dedupe by fileId (meeting wins). */
export function mergeAndDedupeFileLists(meetingFiles: CivicFile[], eventFiles: CivicFile[]): CivicFile[] {
  const byId = new Map<number, CivicFile>();
  for (const f of meetingFiles) byId.set(f.fileId, f);
  for (const f of eventFiles) if (!byId.has(f.fileId)) byId.set(f.fileId, f);
  return Array.from(byId.values());
}

/**
 * True if the requested date range is entirely in the past (end of range before today).
 * For past ranges we prefer DB whenever we have any cached data (no API refetch).
 */
export function isRangeInPast(endDate: string): boolean {
  const end = DateTime.fromISO(endDate, { zone: "America/Denver" });
  const todayDenver = DateTime.now().setZone("America/Denver").startOf("day");
  return end < todayDenver;
}

/**
 * Fetch events for a given date range from API (handles pagination)
 * Note: CivicClerk API has a hard limit of 15 results per page
 */
export async function fetchEventsFromAPI(
  startDate: string,
  endDate: string
): Promise<CivicEvent[]> {
  const filter = `startDateTime ge ${startDate} and startDateTime lt ${endDate}`;
  const allEvents: CivicEvent[] = [];
  let skip = 0;

  while (true) {
    const url = `${API_BASE}/Events?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime asc&$count=true&$skip=${skip}`;

    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const data: EventsResponse = await response.json();

    if (data.value.length === 0) {
      break;
    }

    allEvents.push(...data.value.map(normalizeApiEvent));
    skip += data.value.length;
  }

  return allEvents;
}

/**
 * Fetch meeting details (includes files) by agenda ID
 */
export async function getMeetingDetails(agendaId: number): Promise<MeetingDetails | null> {
  const url = `${API_BASE}/Meetings/${agendaId}`;

  const response = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch meeting: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch current event name from API (no cache). Used to sync list view with API when titles change.
 */
export async function fetchEventNameFromAPI(id: number): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/Events/${id}`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return (data.eventName as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch raw startDateTime string from API (no cache). Used only when correcting event times.
 */
export async function fetchEventStartDateTimeFromAPI(id: number): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/Events/${id}`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return (data.startDateTime as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch ALL events for a given categoryName from API (handles pagination).
 * Returns events newest-first. Used by committee tabs to backfill the DB
 * with the full history for a category.
 */
export async function fetchEventsByCategoryFromAPI(
  categoryName: string,
): Promise<CivicEvent[]> {
  const filter = `categoryName eq '${categoryName.replace(/'/g, "''")}'`;
  const allEvents: CivicEvent[] = [];
  let skip = 0;

  while (true) {
    const url = `${API_BASE}/Events?$filter=${encodeURIComponent(filter)}&$orderby=startDateTime desc&$count=true&$skip=${skip}`;

    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events by category: ${response.status}`);
    }

    const data: EventsResponse = await response.json();

    if (data.value.length === 0) {
      break;
    }

    allEvents.push(...data.value.map(normalizeApiEvent));
    skip += data.value.length;
  }

  return allEvents;
}

/** Strip <mark class="highlight">...</mark> to get plain text */
export function stripHighlight(s: string): string {
  return s.replace(/<mark[^>]*>([^<]*)<\/mark>/gi, '$1');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
