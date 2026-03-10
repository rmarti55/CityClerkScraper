import { NextRequest, NextResponse } from "next/server";
import { getAttachmentFreshUrl } from "@/lib/civicclerk";
import {
  existsSync,
  createReadStream,
  writeFileSync,
  mkdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { Readable } from "stream";

const FILE_CACHE_DIR = join(process.cwd(), "file-cache");

function ensureCacheDir() {
  if (!existsSync(FILE_CACHE_DIR)) {
    mkdirSync(FILE_CACHE_DIR, { recursive: true });
  }
}

function getAttachmentCachePath(attachmentId: number): string {
  return join(FILE_CACHE_DIR, `attachment-${attachmentId}.pdf`);
}

function getCacheStat(attachmentId: number): { size: number; mtimeMs: number } | null {
  const cachePath = getAttachmentCachePath(attachmentId);
  try {
    if (existsSync(cachePath)) {
      const st = statSync(cachePath);
      return { size: st.size, mtimeMs: st.mtimeMs };
    }
  } catch {}
  return null;
}

async function fetchAttachmentFromAPI(
  attachmentId: number,
  agendaId: number,
): Promise<Buffer | null> {
  const freshUrl = await getAttachmentFreshUrl(agendaId, attachmentId);
  if (!freshUrl)
    throw new Error(`Attachment ${attachmentId} not found in meeting ${agendaId}`);

  const response = await fetch(freshUrl);
  if (!response.ok) throw new Error(`Azure Blob returned ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function saveToLocalCache(attachmentId: number, data: Buffer): void {
  try {
    ensureCacheDir();
    writeFileSync(getAttachmentCachePath(attachmentId), data);
  } catch (e) {
    console.warn(`Failed to cache attachment ${attachmentId}:`, e);
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
  const attachmentId = parseInt(id);

  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });
  }

  const agendaIdParam = request.nextUrl.searchParams.get("agendaId");
  const agendaId = agendaIdParam ? parseInt(agendaIdParam) : NaN;

  const isDownload = request.nextUrl.searchParams.get("download") === "true";
  const nameParam = request.nextUrl.searchParams.get("name");
  const filename = nameParam
    ? (nameParam.endsWith(".pdf") ? nameParam : `${nameParam}.pdf`)
    : `attachment-${attachmentId}.pdf`;

  try {
    let stat = getCacheStat(attachmentId);

    if (!stat) {
      if (isNaN(agendaId)) {
        return NextResponse.json(
          { error: "agendaId query param required when attachment is not cached" },
          { status: 400 },
        );
      }
      const fileData = await fetchAttachmentFromAPI(attachmentId, agendaId);
      if (!fileData) {
        return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 500 });
      }
      saveToLocalCache(attachmentId, fileData);
      stat = getCacheStat(attachmentId);
      if (!stat) {
        return NextResponse.json({ error: "Failed to cache attachment" }, { status: 500 });
      }
    }

    return streamCachedFile(
      getAttachmentCachePath(attachmentId),
      stat.size,
      stat.mtimeMs,
      request,
      filename,
      isDownload,
    );
  } catch (error) {
    console.error("Error fetching attachment:", error);

    const stat = getCacheStat(attachmentId);
    if (stat) {
      console.log(`Serving stale cache for attachment ${attachmentId} due to error`);
      return streamCachedFile(
        getAttachmentCachePath(attachmentId),
        stat.size,
        stat.mtimeMs,
        request,
        filename,
        isDownload,
      );
    }

    return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 500 });
  }
}
