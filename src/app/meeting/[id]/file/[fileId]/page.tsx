import { notFound } from "next/navigation";
import { DocumentChatView } from "@/components/DocumentChatView";

interface PageProps {
  params: Promise<{ id: string; fileId: string }>;
  searchParams: Promise<{ name?: string }>;
}

export default async function DocumentChatPage({
  params,
  searchParams,
}: PageProps) {
  const { id, fileId } = await params;
  const { name: fileName } = await searchParams;

  const meetingId = parseInt(id);
  const fileIdNum = parseInt(fileId);

  if (isNaN(meetingId) || isNaN(fileIdNum)) {
    notFound();
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 h-screen flex flex-col lg:max-w-none lg:px-12">
      <DocumentChatView
        fileId={fileIdNum}
        meetingId={meetingId}
        fileName={fileName ?? undefined}
      />
    </main>
  );
}
