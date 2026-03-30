import { NextRequest, NextResponse } from "next/server";
import { getChunksForDocument } from "@/lib/document-rag";
import { getAttachmentPdfBuffer } from "@/lib/file-cache";
import { handleDocumentChat } from "@/lib/document-chat";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attachmentId = parseInt(id);
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });
  }

  const agendaIdParam = request.nextUrl.searchParams.get("agendaId");
  const agendaId = agendaIdParam ? parseInt(agendaIdParam) : NaN;
  if (isNaN(agendaId)) {
    return NextResponse.json({ error: "agendaId query param required" }, { status: 400 });
  }

  return handleDocumentChat(
    request,
    () => getChunksForDocument(
      `attachment-${attachmentId}`,
      () => getAttachmentPdfBuffer(attachmentId, agendaId),
    ),
    `attachment ${attachmentId}`,
  );
}
