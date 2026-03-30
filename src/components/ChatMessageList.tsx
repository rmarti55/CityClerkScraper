"use client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  emptyText?: string;
}

export function ChatMessageList({
  messages,
  loading,
  error,
  messagesEndRef,
  emptyText = "Ask a question about this document.",
}: ChatMessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      {messages.length === 0 && !loading && (
        <p className="text-sm text-gray-500">{emptyText}</p>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={m.role === "user" ? "text-right" : "text-left"}
        >
          <span
            className={
              m.role === "user"
                ? "inline-block px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm max-w-[85%]"
                : "inline-block px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm max-w-[85%] whitespace-pre-wrap"
            }
          >
            {m.content}
          </span>
        </div>
      ))}
      {loading && (
        <div className="text-left">
          <span className="inline-block px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm">
            Thinking&hellip;
          </span>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div ref={messagesEndRef} />
    </div>
  );
}
