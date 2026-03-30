import { NextRequest, NextResponse } from "next/server";
import { getPdfBuffer } from "@/lib/file-cache";
import { getPdfPageCount } from "@/lib/pdf-metadata";
import { db, files } from "@/lib/db";
import { eq } from "drizzle-orm";

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
    const cachedFile = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (cachedFile.length > 0 && cachedFile[0].fileSize !== null) {
      return NextResponse.json({
        size: cachedFile[0].fileSize,
        pageCount: cachedFile[0].pageCount,
      });
    }

    const fileData = await getPdfBuffer(fileId);
    if (!fileData) {
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: 500 }
      );
    }

    const size = fileData.length;
    const pageCount = await getPdfPageCount(fileData);

    try {
      if (cachedFile.length > 0) {
        await db
          .update(files)
          .set({ fileSize: size, pageCount })
          .where(eq(files.id, fileId));
      }
    } catch (dbError) {
      console.warn("Failed to cache file metadata:", dbError);
    }

    return NextResponse.json({ size, pageCount });
  } catch (error) {
    console.error("Error fetching file metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch file metadata" },
      { status: 500 }
    );
  }
}
