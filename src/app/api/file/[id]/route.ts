import { NextRequest, NextResponse } from "next/server";
import { getFileUrl } from "@/lib/civicclerk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// File cache directory (relative to project root)
const FILE_CACHE_DIR = join(process.cwd(), "file-cache");

// Ensure cache directory exists
function ensureCacheDir() {
  if (!existsSync(FILE_CACHE_DIR)) {
    mkdirSync(FILE_CACHE_DIR, { recursive: true });
  }
}

// Get cached file path
function getCachedFilePath(fileId: number): string {
  return join(FILE_CACHE_DIR, `${fileId}.pdf`);
}

// Check if file is cached locally
function getLocalCache(fileId: number): Buffer | null {
  const cachePath = getCachedFilePath(fileId);
  if (existsSync(cachePath)) {
    try {
      return readFileSync(cachePath);
    } catch (error) {
      console.warn(`Failed to read cached file ${fileId}:`, error);
    }
  }
  return null;
}

// Save file to local cache
function saveToLocalCache(fileId: number, data: Buffer): void {
  try {
    ensureCacheDir();
    const cachePath = getCachedFilePath(fileId);
    writeFileSync(cachePath, data);
  } catch (error) {
    console.warn(`Failed to cache file ${fileId}:`, error);
  }
}

// Fetch file from CivicClerk API (handles blobUri response)
async function fetchFileFromAPI(fileId: number): Promise<Buffer | null> {
  const apiUrl = getFileUrl(fileId);
  
  // First, get the blobUri from the API
  const apiResponse = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
  });

  if (!apiResponse.ok) {
    throw new Error(`API returned ${apiResponse.status}`);
  }

  const data = await apiResponse.json();
  
  if (!data.blobUri) {
    throw new Error("No blobUri in API response");
  }

  // Now fetch the actual file from Azure Blob Storage
  const fileResponse = await fetch(data.blobUri);
  
  if (!fileResponse.ok) {
    throw new Error(`Blob storage returned ${fileResponse.status}`);
  }

  const arrayBuffer = await fileResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = parseInt(id);

  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const isDownload = request.nextUrl.searchParams.get("download") === "true";
  const filename = `file-${fileId}.pdf`;

  try {
    // 1. Check local cache first
    let fileData = getLocalCache(fileId);

    // 2. If not cached, fetch from API
    if (!fileData) {
      fileData = await fetchFileFromAPI(fileId);
      
      // 3. Cache locally for future requests
      if (fileData) {
        saveToLocalCache(fileId, fileData);
      }
    }

    if (!fileData) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 500 }
      );
    }

    // 4. Serve the file
    const headers: HeadersInit = {
      "Content-Type": "application/pdf",
      "Content-Length": fileData.length.toString(),
    };

    if (isDownload) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    } else {
      headers["Content-Disposition"] = `inline; filename="${filename}"`;
    }

    return new NextResponse(new Uint8Array(fileData), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error fetching file:", error);
    
    // Try to serve from cache even if API fails (stale cache fallback)
    const cachedData = getLocalCache(fileId);
    if (cachedData) {
      console.log(`Serving stale cache for file ${fileId} due to API error`);
      const headers: HeadersInit = {
        "Content-Type": "application/pdf",
        "Content-Length": cachedData.length.toString(),
      };
      if (isDownload) {
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      } else {
        headers["Content-Disposition"] = `inline; filename="${filename}"`;
      }
      return new NextResponse(new Uint8Array(cachedData), { status: 200, headers });
    }

    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    );
  }
}
