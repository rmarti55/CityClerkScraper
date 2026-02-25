import { NextRequest, NextResponse } from "next/server";
import { getPdfBuffer } from "@/lib/file-cache";
import { extractTextFromPdf } from "@/lib/document-text";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = parseInt(id);
  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }
  try {
    const buffer = await getPdfBuffer(fileId);
    if (!buffer) {
      return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
    }
    const { text } = await extractTextFromPdf(buffer);
    return NextResponse.json({ text });
  } catch (e) {
    console.error("Error extracting text for file", fileId, e);
    return NextResponse.json(
      { error: "Failed to extract text from document" },
      { status: 500 }
    );
  }
}
