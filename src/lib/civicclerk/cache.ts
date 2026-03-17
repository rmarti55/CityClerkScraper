import { db, events, files } from '../db';
import { parseEventStartDateTime } from '../datetime';
import type { CivicEvent, CivicFile } from '../types';

// Cache duration constants
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Get cache duration based on event age
 * - Events > 30 days old: permanent (historical records don't change)
 * - Events 7-30 days old: 24 hours (minutes might still be added)
 * - Events < 7 days old or future: 1 hour (agenda updates possible)
 */
export function getCacheDuration(eventDate: Date): number {
  const ageInDays = (Date.now() - eventDate.getTime()) / ONE_DAY_MS;

  if (ageInDays > 30) {
    return Infinity;
  } else if (ageInDays > 7) {
    return ONE_DAY_MS;
  } else {
    return ONE_HOUR_MS;
  }
}

/**
 * Check if cached data is still fresh based on event date.
 * Uses age-based caching: older events have longer cache duration.
 */
export function isCacheFresh(cachedAt: Date | null, eventDate: Date, hasFileNames?: boolean): boolean {
  if (!cachedAt) return false;
  if (hasFileNames === false) return false;
  const cacheDuration = getCacheDuration(eventDate);
  if (cacheDuration === Infinity) return true;
  return Date.now() - cachedAt.getTime() < cacheDuration;
}

/**
 * Map a cached DB event row to the CivicEvent format.
 */
export function mapCachedEvent(e: typeof events.$inferSelect): CivicEvent {
  return {
    id: e.id,
    eventName: e.eventName,
    eventDescription: e.eventDescription || '',
    eventDate: e.eventDate,
    startDateTime: e.startDateTime.toISOString(),
    agendaId: e.agendaId,
    agendaName: e.agendaName || '',
    categoryName: e.categoryName || '',
    isPublished: e.isPublished || '',
    venueName: e.venueName || undefined,
    venueAddress: e.venueAddress || undefined,
    venueCity: e.venueCity || undefined,
    venueState: e.venueState || undefined,
    venueZip: e.venueZip || undefined,
    fileCount: e.fileCount || 0,
    fileNames: e.fileNames || undefined,
    cachedAt: e.cachedAt ? e.cachedAt.toISOString() : undefined,
  };
}

/**
 * Map a cached DB file row to the CivicFile format.
 */
export function mapCachedFile(f: typeof files.$inferSelect): CivicFile {
  return {
    fileId: f.id,
    name: f.name,
    type: f.type,
    url: f.url,
    publishOn: f.publishOn || '',
    fileType: f.fileType || 0,
  };
}

/**
 * Upsert a single event into the DB cache.
 *
 * Consolidates the 3 previously duplicated upsert blocks. The subtle
 * differences between the old callers were:
 *
 *   - refreshEventById passed `?? null` for venue fields in .values();
 *     the other two passed the raw value (possibly `undefined`).
 *     We now always use `?? null` for safety — Drizzle treats both
 *     `undefined` and `null` as SQL NULL for nullable text columns,
 *     but explicit null is clearer.
 *
 *   - refreshEventById included `isPublished` in the .set() (conflict
 *     update); the other two did not. We now always include it — there
 *     is no reason to skip updating isPublished on conflict.
 *
 *   - refreshEventById used a shared `now` Date; the others created
 *     new Date() per iteration. We accept an optional `cachedAt` param
 *     so callers can share a timestamp if they want consistency.
 */
export async function upsertEvent(
  e: CivicEvent,
  opts?: {
    fileCount?: number;
    fileNames?: string;
    cachedAt?: Date;
  }
): Promise<void> {
  const fileCount = opts?.fileCount ?? e.fileCount ?? 0;
  const fileNames = opts?.fileNames ?? e.fileNames ?? '';
  const cachedAt = opts?.cachedAt ?? new Date();

  await db.insert(events)
    .values({
      id: e.id,
      eventName: e.eventName,
      eventDescription: e.eventDescription,
      eventDate: e.eventDate,
      startDateTime: parseEventStartDateTime(e.startDateTime),
      agendaId: e.agendaId,
      agendaName: e.agendaName,
      categoryName: e.categoryName,
      isPublished: e.isPublished,
      venueName: e.venueName ?? null,
      venueAddress: e.venueAddress ?? null,
      venueCity: e.venueCity ?? null,
      venueState: e.venueState ?? null,
      venueZip: e.venueZip ?? null,
      fileCount: fileCount || 0,
      fileNames: fileNames || '',
      cachedAt,
    })
    .onConflictDoUpdate({
      target: events.id,
      set: {
        eventName: e.eventName,
        eventDescription: e.eventDescription,
        startDateTime: parseEventStartDateTime(e.startDateTime),
        agendaId: e.agendaId,
        agendaName: e.agendaName,
        categoryName: e.categoryName,
        isPublished: e.isPublished,
        venueName: e.venueName ?? null,
        venueAddress: e.venueAddress ?? null,
        venueCity: e.venueCity ?? null,
        venueState: e.venueState ?? null,
        venueZip: e.venueZip ?? null,
        fileCount: fileCount || 0,
        fileNames: fileNames || '',
        cachedAt,
      },
    });
}

/**
 * Upsert files into the DB cache.
 *
 * Consolidates the 3 previously duplicated file upsert blocks.
 * All three used the same Drizzle column-ref pattern in .set()
 * (which means SET col = EXCLUDED.col, i.e. update to the new value).
 *
 * The backfill caller chunked into batches of 100; we always chunk
 * to be safe with large file lists.
 */
export async function upsertFiles(
  eventId: number,
  fileList: CivicFile[],
  opts?: { cachedAt?: Date }
): Promise<void> {
  if (fileList.length === 0) return;

  const cachedAt = opts?.cachedAt ?? new Date();
  const rows = fileList.map((f) => ({
    id: f.fileId,
    eventId,
    name: f.name,
    type: f.type,
    url: f.url,
    publishOn: f.publishOn,
    fileType: f.fileType,
    cachedAt,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await db
      .insert(files)
      .values(chunk)
      .onConflictDoUpdate({
        target: files.id,
        set: {
          name: files.name,
          type: files.type,
          url: files.url,
          cachedAt,
        },
      });
  }
}
