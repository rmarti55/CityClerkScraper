import { notFound } from "next/navigation";
import { DocumentChatView } from "@/components/DocumentChatView";
import Link from "next/link";

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
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link
          href={`/meeting/${meetingId}`}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          ← Back to meeting
        </Link>
      </div>
      <DocumentChatView
        fileId={fileIdNum}
        meetingId={meetingId}
        fileName={fileName ?? undefined}
      />
    </main>
  );
}
