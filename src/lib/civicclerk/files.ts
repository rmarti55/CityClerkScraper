import { db, events, files } from '../db';
import { eq } from 'drizzle-orm';
import type { CivicFile, MeetingItem, ItemAttachment } from '../types';
import {
  API_BASE,
  fetchEventPublishedFilesFromAPI,
  mergeAndDedupeFileLists,
  isFebruary2026,
  getMeetingDetails,
} from './api';
import { getEventById } from './events';
import { isCacheFresh, mapCachedFile, upsertFiles } from './cache';

/**
 * Fetch files for an event (via its agendaId)
 */
export async function getEventFiles(eventId: number): Promise<CivicFile[]> {
  let cachedFilesList: (typeof files.$inferSelect)[] = [];

  try {
    const [cachedFiles, cachedEvent] = await Promise.all([
      db.select().from(files).where(eq(files.eventId, eventId)),
      db.select().from(events).where(eq(events.id, eventId)).limit(1)
    ]);

    cachedFilesList = cachedFiles;

    if (cachedFiles.length > 0 && cachedEvent.length > 0) {
      if (isCacheFresh(cachedFiles[0].cachedAt, cachedEvent[0].startDateTime)) {
        return cachedFiles.map(mapCachedFile);
      }
    }
  } catch (error) {
    console.warn('Database cache unavailable:', error);
  }

  try {
    const event = await getEventById(eventId);
    if (!event) {
      return cachedFilesList.length > 0 ? cachedFilesList.map(mapCachedFile) : [];
    }

    const meeting = event.agendaId != null ? await getMeetingDetails(event.agendaId) : null;
    const meetingFiles: CivicFile[] = meeting?.publishedFiles ?? [];

    let eventFiles: CivicFile[] = [];
    if (isFebruary2026(new Date(event.startDateTime))) {
      eventFiles = await fetchEventPublishedFilesFromAPI(eventId);
    }

    const publishedFiles = mergeAndDedupeFileLists(meetingFiles, eventFiles);

    try {
      await upsertFiles(eventId, publishedFiles);
    } catch (cacheError) {
      console.warn('Failed to cache files:', cacheError);
    }

    return publishedFiles;
  } catch (apiError) {
    console.warn('API unavailable for files, falling back to stale cache:', apiError);
    if (cachedFilesList.length > 0) {
      console.log(`Serving ${cachedFilesList.length} stale cached files for event ${eventId}`);
      return cachedFilesList.map(mapCachedFile);
    }
    return [];
  }
}

/**
 * Get the download URL for a file (for streaming/viewing)
 */
export function getFileDownloadUrl(fileId: number): string {
  return `${API_BASE}/Meetings/GetMeetingFileStream(fileId=${fileId},plainText=false)`;
}

/**
 * Get the direct file URL (alternative endpoint)
 */
export function getFileUrl(fileId: number): string {
  return `${API_BASE}/Meetings/GetMeetingFile(fileId=${fileId},plainText=false)`;
}

/**
 * Recursively collect all attachments across items and their childItems.
 */
function collectAllAttachments(items: MeetingItem[]): ItemAttachment[] {
  const result: ItemAttachment[] = [];
  for (const item of items) {
    if (item.attachmentsList) result.push(...item.attachmentsList);
    if (item.childItems?.length) result.push(...collectAllAttachments(item.childItems));
  }
  return result;
}

/**
 * Fetch a fresh pdfVersionFullPath SAS URL for a specific attachment.
 * The SAS URL expires every ~7 days so we re-fetch the meeting each time
 * we need a URL and the PDF is not already in the disk cache.
 */
export async function getAttachmentFreshUrl(agendaId: number, attachmentId: number): Promise<string | null> {
  const meeting = await getMeetingDetails(agendaId);
  if (!meeting) return null;
  const allAttachments = collectAllAttachments(meeting.items ?? []);
  const attachment = allAttachments.find((a) => a.id === attachmentId);
  return attachment?.pdfVersionFullPath ?? null;
}
