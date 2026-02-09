import { NextRequest, NextResponse } from "next/server";
import { getFileUrl } from "@/lib/civicclerk";
import { db, files } from "@/lib/db";
import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// File cache directory (same as main file route)
const FILE_CACHE_DIR = join(process.cwd(), "file-cache");

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

// Fetch file from CivicClerk API (handles blobUri response)
async function fetchFileFromAPI(fileId: number): Promise<Buffer | null> {
  const apiUrl = getFileUrl(fileId);

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

  const fileResponse = await fetch(data.blobUri);

  if (!fileResponse.ok) {
    throw new Error(`Blob storage returned ${fileResponse.status}`);
  }

  const arrayBuffer = await fileResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Count pages in a PDF
async function getPdfPageCount(data: Buffer): Promise<number | null> {
  try {
    const pdfDoc = await PDFDocument.load(data, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.warn("Failed to parse PDF for page count:", error);
    return null;
  }
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

  try {
    // 1. Check if we have cached metadata in the database
    const cachedFile = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (cachedFile.length > 0 && cachedFile[0].fileSize !== null) {
      // Return cached metadata
      return NextResponse.json({
        size: cachedFile[0].fileSize,
        pageCount: cachedFile[0].pageCount,
      });
    }

    // 2. Get the file data (from local cache or API)
    let fileData = getLocalCache(fileId);

    if (!fileData) {
      fileData = await fetchFileFromAPI(fileId);
    }

    if (!fileData) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 500 }
      );
    }

    // 3. Extract metadata
    const size = fileData.length;
    const pageCount = await getPdfPageCount(fileData);

    // 4. Cache metadata in database (if file record exists)
    try {
      if (cachedFile.length > 0) {
        await db
          .update(files)
          .set({
            fileSize: size,
            pageCount: pageCount,
          })
          .where(eq(files.id, fileId));
      }
    } catch (dbError) {
      // Don't fail the request if caching fails
      console.warn("Failed to cache file metadata:", dbError);
    }

    // 5. Return metadata
    return NextResponse.json({
      size,
      pageCount,
    });
  } catch (error) {
    console.error("Error fetching file metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch file metadata" },
      { status: 500 }
    );
  }
}
