"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InlineDocumentChatProps {
  chatEndpoint: string;
}

export function InlineDocumentChat({ chatEndpoint }: InlineDocumentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevEndpointRef = useRef(chatEndpoint);

  useEffect(() => {
    if (prevEndpointRef.current !== chatEndpoint) {
      setMessages([]);
      setInput("");
      setError(null);
      setLoading(false);
      prevEndpointRef.current = chatEndpoint;
    }
  }, [chatEndpoint]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content ?? "" },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && !loading && (
          <p className="text-sm text-gray-500">
            Ask a question about this document.
          </p>
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
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this document…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
