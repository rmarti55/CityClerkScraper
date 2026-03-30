import { NextRequest, NextResponse } from "next/server";
import { getAttachmentPdfBuffer } from "@/lib/file-cache";
import { servePdf } from "@/lib/pdf-stream";

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

  return servePdf(
    request,
    attachmentId,
    "attachment-",
    `attachment-${attachmentId}.pdf`,
    async () => {
      if (isNaN(agendaId)) {
        throw new Error("agendaId query param required when attachment is not cached");
      }
      return getAttachmentPdfBuffer(attachmentId, agendaId);
    },
  );
}
