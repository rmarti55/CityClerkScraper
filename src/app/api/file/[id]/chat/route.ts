import { NextRequest, NextResponse } from "next/server";
import { getChunksWithEmbeddings } from "@/lib/document-rag";
import { handleDocumentChat } from "@/lib/document-chat";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = parseInt(id);
  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  return handleDocumentChat(
    request,
    () => getChunksWithEmbeddings(fileId),
    `file ${fileId}`,
  );
}
