import type { CivicEvent, CivicFile } from '../types';
import { fetchEventsFromAPI, getMeetingDetails, sleep } from './api';
import { upsertEvent, upsertFiles } from './cache';

export interface BackfillResult {
  eventsCount: number;
  meetingsCalls: number;
}

/**
 * Backfill a date range from the API into the database (no cache check).
 * Fetches events, then meeting details in batches with throttle, then upserts events and files.
 * Use for one-time historical backfill (e.g. last 5 years).
 */
export async function backfillDateRange(
  startDate: string,
  endDate: string,
  options?: { throttleMs?: number }
): Promise<BackfillResult> {
  const throttleMs = options?.throttleMs ?? 150;
  const batchSize = 5;

  const fetchedEvents = await fetchEventsFromAPI(startDate, endDate);
  const eventsWithCounts: CivicEvent[] = [];
  const filesToUpsert: { eventId: number; file: CivicFile }[] = [];

  for (let i = 0; i < fetchedEvents.length; i += batchSize) {
    const batch = fetchedEvents.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (event) => {
        try {
          if (!event.agendaId) {
            return { ...event, fileCount: 0, fileNames: '' };
          }
          const meeting = await getMeetingDetails(event.agendaId);
          const fileCount = meeting?.publishedFiles?.length || 0;
          const fileNames = meeting?.publishedFiles?.map((f) => f.name).join(' ') || '';
          if (meeting?.publishedFiles?.length) {
            filesToUpsert.push(
              ...meeting.publishedFiles.map((f) => ({ eventId: event.id, file: f }))
            );
          }
          return { ...event, fileCount, fileNames };
        } catch {
          return { ...event, fileCount: 0, fileNames: '' };
        }
      })
    );
    eventsWithCounts.push(...batchResults);
    if (i + batchSize < fetchedEvents.length) {
      await sleep(throttleMs);
    }
  }

  const meetingsCalls = eventsWithCounts.filter((e) => e.agendaId).length;

  for (const e of eventsWithCounts) {
    await upsertEvent(e);
  }

  const filesByEvent = new Map<number, CivicFile[]>();
  for (const { eventId, file } of filesToUpsert) {
    const list = filesByEvent.get(eventId) ?? [];
    list.push(file);
    filesByEvent.set(eventId, list);
  }
  for (const [eventId, fileList] of filesByEvent) {
    await upsertFiles(eventId, fileList);
  }

  return { eventsCount: eventsWithCounts.length, meetingsCalls };
}
