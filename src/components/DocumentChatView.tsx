"use client";

import Link from "next/link";
import { useDocumentChat } from "@/hooks/useDocumentChat";
import { ChatMessageList } from "@/components/ChatMessageList";

interface DocumentChatViewProps {
  meetingId: number;
  fileName?: string;
  fileId?: number;
  attachmentId?: number;
  agendaId?: number;
}

export function DocumentChatView({ fileId, meetingId, fileName, attachmentId, agendaId }: DocumentChatViewProps) {
  const isAttachment = attachmentId != null && agendaId != null;
  const pdfSrc = isAttachment
    ? `/api/attachment/${attachmentId}?agendaId=${agendaId}`
    : `/api/file/${fileId}`;
  const chatEndpoint = isAttachment
    ? `/api/attachment/${attachmentId}/chat?agendaId=${agendaId}`
    : `/api/file/${fileId}/chat`;

  const chat = useDocumentChat(chatEndpoint);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2 mb-3">
        <Link
          href={`/meeting/${meetingId}`}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          ← Back to meeting
        </Link>
        {fileName && (
          <span className="text-sm text-gray-600 truncate" title={fileName}>
            {fileName}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 flex flex-col min-h-[300px]">
          <div className="bg-white px-3 py-2 border-b border-gray-200 text-sm font-medium text-gray-800">
            Document
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              src={pdfSrc}
              title="PDF"
              className="w-full h-full min-h-[300px]"
            />
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg flex flex-col bg-white min-h-[300px]">
          <div className="px-3 py-2 border-b border-gray-200 text-sm font-medium text-gray-800">
            Chat with document
          </div>
          <ChatMessageList
            messages={chat.messages}
            loading={chat.loading}
            error={chat.error}
            messagesEndRef={chat.messagesEndRef}
            emptyText="Ask a question about this document. Answers are based only on the document content."
          />
          <form onSubmit={chat.handleSubmit} className="p-3 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                placeholder="Ask about this document…"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={chat.loading}
              />
              <button
                type="submit"
                disabled={chat.loading || !chat.input.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
