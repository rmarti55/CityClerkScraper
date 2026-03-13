import { NextRequest, NextResponse } from "next/server";
import { getFileUrl } from "@/lib/civicclerk";
import {
  existsSync,
  createReadStream,
  writeFileSync,
  mkdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { Readable } from "stream";

const FILE_CACHE_DIR = process.env.VERCEL
  ? join("/tmp", "file-cache")
  : join(process.cwd(), "file-cache");

function ensureCacheDir() {
  if (!existsSync(FILE_CACHE_DIR)) {
    mkdirSync(FILE_CACHE_DIR, { recursive: true });
  }
}

function getCachedFilePath(fileId: number): string {
  return join(FILE_CACHE_DIR, `${fileId}.pdf`);
}

function getCacheStat(fileId: number): { size: number; mtimeMs: number } | null {
  const cachePath = getCachedFilePath(fileId);
  try {
    if (existsSync(cachePath)) {
      const st = statSync(cachePath);
      return { size: st.size, mtimeMs: st.mtimeMs };
    }
  } catch {}
  return null;
}

async function fetchFileFromAPI(fileId: number): Promise<Buffer | null> {
  const apiUrl = getFileUrl(fileId);
  const apiResponse = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
  });
  if (!apiResponse.ok) throw new Error(`API returned ${apiResponse.status}`);

  const data = await apiResponse.json();
  if (!data.blobUri) throw new Error("No blobUri in API response");

  const fileResponse = await fetch(data.blobUri);
  if (!fileResponse.ok)
    throw new Error(`Blob storage returned ${fileResponse.status}`);

  const arrayBuffer = await fileResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function saveToLocalCache(fileId: number, data: Buffer): void {
  try {
    ensureCacheDir();
    writeFileSync(getCachedFilePath(fileId), data);
  } catch (e) {
    console.warn(`Failed to cache file ${fileId}:`, e);
  }
}

function nodeStreamToWeb(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

function streamCachedFile(
  cachePath: string,
  fileSize: number,
  mtimeMs: number,
  request: NextRequest,
  filename: string,
  isDownload: boolean,
): NextResponse {
  const etag = `"${fileSize.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  const disposition = isDownload
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  const commonHeaders: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400, immutable",
    ETag: etag,
    "Content-Disposition": disposition,
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(cachePath, { start, end });
      return new NextResponse(nodeStreamToWeb(stream), {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunkSize.toString(),
        },
      });
    }
  }

  const stream = createReadStream(cachePath);
  return new NextResponse(nodeStreamToWeb(stream), {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": fileSize.toString(),
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fileId = parseInt(id);

  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  const isDownload = request.nextUrl.searchParams.get("download") === "true";
  const nameParam = request.nextUrl.searchParams.get("name");
  const filename = nameParam
    ? (nameParam.endsWith(".pdf") ? nameParam : `${nameParam}.pdf`)
    : `file-${fileId}.pdf`;

  try {
    let stat = getCacheStat(fileId);

    if (!stat) {
      const fileData = await fetchFileFromAPI(fileId);
      if (!fileData) {
        return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
      }
      saveToLocalCache(fileId, fileData);
      stat = getCacheStat(fileId);
      if (!stat) {
        const disposition = isDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`;
        return new NextResponse(new Uint8Array(fileData), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": fileData.length.toString(),
            "Content-Disposition": disposition,
          },
        });
      }
    }

    return streamCachedFile(
      getCachedFilePath(fileId),
      stat.size,
      stat.mtimeMs,
      request,
      filename,
      isDownload,
    );
  } catch (error) {
    console.error("Error fetching file:", error);

    const stat = getCacheStat(fileId);
    if (stat) {
      console.log(`Serving stale cache for file ${fileId} due to API error`);
      return streamCachedFile(
        getCachedFilePath(fileId),
        stat.size,
        stat.mtimeMs,
        request,
        filename,
        isDownload,
      );
    }

    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
