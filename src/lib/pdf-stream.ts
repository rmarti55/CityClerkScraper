/**
 * Shared PDF streaming, disk caching, and HTTP response utilities.
 * Used by both file and attachment API routes.
 */

import { NextRequest, NextResponse } from "next/server";
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

export function getCachePath(prefix: string, id: number): string {
  const filename = prefix ? `${prefix}${id}.pdf` : `${id}.pdf`;
  return join(FILE_CACHE_DIR, filename);
}

export function getCacheStat(
  prefix: string,
  id: number,
): { size: number; mtimeMs: number } | null {
  const cachePath = getCachePath(prefix, id);
  try {
    if (existsSync(cachePath)) {
      const st = statSync(cachePath);
      return { size: st.size, mtimeMs: st.mtimeMs };
    }
  } catch {}
  return null;
}

export function saveToCache(prefix: string, id: number, data: Buffer): void {
  try {
    ensureCacheDir();
    writeFileSync(getCachePath(prefix, id), data);
  } catch (e) {
    console.warn(`Failed to cache ${prefix || "file "}${id}:`, e);
  }
}

function nodeStreamToWeb(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk)),
      );
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export function streamCachedPdf(
  cachePath: string,
  stat: { size: number; mtimeMs: number },
  request: NextRequest,
  filename: string,
  isDownload: boolean,
): NextResponse {
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

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
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(cachePath, { start, end });
      return new NextResponse(nodeStreamToWeb(stream), {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
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
      "Content-Length": stat.size.toString(),
    },
  });
}

/**
 * Serve a PDF from cache or fetch it, with ETag/range/stale-cache support.
 * Shared handler for both file and attachment streaming routes.
 */
export async function servePdf(
  request: NextRequest,
  id: number,
  cachePrefix: string,
  defaultFilename: string,
  fetchBuffer: () => Promise<Buffer | null>,
): Promise<NextResponse> {
  const isDownload = request.nextUrl.searchParams.get("download") === "true";
  const nameParam = request.nextUrl.searchParams.get("name");
  const filename = nameParam
    ? nameParam.endsWith(".pdf") ? nameParam : `${nameParam}.pdf`
    : defaultFilename;

  try {
    let stat = getCacheStat(cachePrefix, id);

    if (!stat) {
      const data = await fetchBuffer();
      if (!data) {
        return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
      }
      saveToCache(cachePrefix, id, data);
      stat = getCacheStat(cachePrefix, id);
      if (!stat) {
        const disposition = isDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`;
        return new NextResponse(new Uint8Array(data), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": data.length.toString(),
            "Content-Disposition": disposition,
          },
        });
      }
    }

    return streamCachedPdf(
      getCachePath(cachePrefix, id),
      stat,
      request,
      filename,
      isDownload,
    );
  } catch (error) {
    console.error(`Error fetching ${cachePrefix || "file "}${id}:`, error);

    const stat = getCacheStat(cachePrefix, id);
    if (stat) {
      console.log(`Serving stale cache for ${cachePrefix || "file "}${id} due to error`);
      return streamCachedPdf(
        getCachePath(cachePrefix, id),
        stat,
        request,
        filename,
        isDownload,
      );
    }

    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}
