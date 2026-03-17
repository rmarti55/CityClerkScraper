import { NextRequest, NextResponse } from "next/server";
import { getAttachmentPdfBuffer } from "@/lib/file-cache";
import { PDFDocument } from "pdf-lib";
import { db, attachmentMetadata } from "@/lib/db";
import { eq } from "drizzle-orm";

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
  const attachmentId = parseInt(id);

  if (isNaN(attachmentId)) {
    return NextResponse.json(
      { error: "Invalid attachment ID" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const agendaId = parseInt(searchParams.get("agendaId") ?? "");

  if (isNaN(agendaId)) {
    return NextResponse.json(
      { error: "agendaId query parameter is required" },
      { status: 400 }
    );
  }

  // Check DB cache first
  try {
    const cached = await db
      .select()
      .from(attachmentMetadata)
      .where(eq(attachmentMetadata.attachmentId, attachmentId))
      .limit(1);

    if (cached.length > 0 && cached[0].fileSize != null) {
      return NextResponse.json({
        size: cached[0].fileSize,
        pageCount: cached[0].pageCount,
      });
    }
  } catch (dbError) {
    console.warn("DB cache read failed for attachment metadata:", dbError);
  }

  try {
    const pdfBuffer = await getAttachmentPdfBuffer(attachmentId, agendaId);

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: "Failed to fetch attachment" },
        { status: 500 }
      );
    }

    const size = pdfBuffer.length;
    const pageCount = await getPdfPageCount(pdfBuffer);

    // Persist to DB for future requests
    try {
      await db.insert(attachmentMetadata).values({
        attachmentId,
        agendaId,
        fileSize: size,
        pageCount,
      }).onConflictDoUpdate({
        target: attachmentMetadata.attachmentId,
        set: {
          fileSize: size,
          pageCount,
          cachedAt: new Date(),
        },
      });
    } catch (dbError) {
      console.warn("Failed to cache attachment metadata in DB:", dbError);
    }

    return NextResponse.json({ size, pageCount });
  } catch (error) {
    console.error("Error fetching attachment metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachment metadata" },
      { status: 500 }
    );
  }
}
