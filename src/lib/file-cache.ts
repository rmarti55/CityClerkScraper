/**
 * Shared PDF buffer access for file serving, metadata, and document text/RAG.
 * Reuses the same cache directory and fetch logic as the file API route.
 */

import { getFileUrl, getAttachmentFreshUrl } from "@/lib/civicclerk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const FILE_CACHE_DIR = join("/tmp", "file-cache");

function ensureCacheDir() {
  if (!existsSync(FILE_CACHE_DIR)) {
    mkdirSync(FILE_CACHE_DIR, { recursive: true });
  }
}

function getCachedFilePath(fileId: number): string {
  return join(FILE_CACHE_DIR, `${fileId}.pdf`);
}

async function fetchFileFromAPI(fileId: number): Promise<Buffer | null> {
  const apiUrl = getFileUrl(fileId);
  const apiResponse = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
  });
  if (!apiResponse.ok) throw new Error(`API returned ${apiResponse.status}`);
  const data = (await apiResponse.json()) as { blobUri?: string };
  if (!data.blobUri) throw new Error("No blobUri in API response");
  const fileResponse = await fetch(data.blobUri);
  if (!fileResponse.ok) throw new Error(`Blob storage returned ${fileResponse.status}`);
  const arrayBuffer = await fileResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get PDF buffer for a file: from local cache or by fetching from the API and caching.
 */
export async function getPdfBuffer(fileId: number): Promise<Buffer | null> {
  const cachePath = getCachedFilePath(fileId);
  if (existsSync(cachePath)) {
    try {
      return readFileSync(cachePath);
    } catch (e) {
      console.warn(`Failed to read cached file ${fileId}:`, e);
    }
  }
  const data = await fetchFileFromAPI(fileId);
  if (data) {
    try {
      ensureCacheDir();
      writeFileSync(cachePath, data);
    } catch (e) {
      console.warn(`Failed to cache file ${fileId}:`, e);
    }
  }
  return data;
}

function getAttachmentCachePath(attachmentId: number): string {
  return join(FILE_CACHE_DIR, `attachment-${attachmentId}.pdf`);
}

/**
 * Get PDF buffer for an agenda item attachment.
 * Checks disk cache first; if not cached, fetches via a fresh SAS URL from the meeting API.
 */
export async function getAttachmentPdfBuffer(attachmentId: number, agendaId: number): Promise<Buffer | null> {
  const cachePath = getAttachmentCachePath(attachmentId);
  if (existsSync(cachePath)) {
    try {
      return readFileSync(cachePath);
    } catch (e) {
      console.warn(`Failed to read cached attachment ${attachmentId}:`, e);
    }
  }

  const freshUrl = await getAttachmentFreshUrl(agendaId, attachmentId);
  if (!freshUrl) return null;

  const response = await fetch(freshUrl);
  if (!response.ok) throw new Error(`Azure Blob returned ${response.status} for attachment ${attachmentId}`);

  const data = Buffer.from(await response.arrayBuffer());
  try {
    ensureCacheDir();
    writeFileSync(cachePath, data);
  } catch (e) {
    console.warn(`Failed to cache attachment ${attachmentId}:`, e);
  }
  return data;
}
