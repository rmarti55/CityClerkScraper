import { notFound } from "next/navigation";
import { DocumentChatView } from "@/components/DocumentChatView";
import { getEventById } from "@/lib/civicclerk";

interface PageProps {
  params: Promise<{ id: string; attachmentId: string }>;
  searchParams: Promise<{ name?: string }>;
}

export default async function AttachmentChatPage({
  params,
  searchParams,
}: PageProps) {
  const { id, attachmentId } = await params;
  const { name: fileName } = await searchParams;

  const meetingId = parseInt(id);
  const attachmentIdNum = parseInt(attachmentId);

  if (isNaN(meetingId) || isNaN(attachmentIdNum)) {
    notFound();
  }

  const event = await getEventById(meetingId);
  if (!event || event.agendaId == null) {
    notFound();
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 h-screen flex flex-col">
      <DocumentChatView
        meetingId={meetingId}
        attachmentId={attachmentIdNum}
        agendaId={event.agendaId}
        fileName={fileName ?? undefined}
      />
    </main>
  );
}
