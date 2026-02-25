/**
 * Shared PDF buffer access for file serving, metadata, and document text/RAG.
 * Reuses the same cache directory and fetch logic as the file API route.
 */

import { getFileUrl } from "@/lib/civicclerk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const FILE_CACHE_DIR = join(process.cwd(), "file-cache");

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
