import { NextRequest, NextResponse } from "next/server";
import { getPdfBuffer } from "@/lib/file-cache";
import { servePdf } from "@/lib/pdf-stream";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fileId = parseInt(id);

  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  return servePdf(
    request,
    fileId,
    "",
    `file-${fileId}.pdf`,
    () => getPdfBuffer(fileId),
  );
}
