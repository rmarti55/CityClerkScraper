"use client";

import { useDocumentChat } from "@/hooks/useDocumentChat";
import { ChatMessageList } from "@/components/ChatMessageList";

interface InlineDocumentChatProps {
  chatEndpoint: string;
}

export function InlineDocumentChat({ chatEndpoint }: InlineDocumentChatProps) {
  const chat = useDocumentChat(chatEndpoint);

  return (
    <div className="flex flex-col h-full bg-white">
      <ChatMessageList
        messages={chat.messages}
        loading={chat.loading}
        error={chat.error}
        messagesEndRef={chat.messagesEndRef}
        emptyText="Ask a question about this document."
      />
      <form onSubmit={chat.handleSubmit} className="p-3 border-t border-gray-200 shrink-0">
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
  );
}
