"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UseDocumentChatResult {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleSubmit: (e: React.FormEvent) => void;
}

export function useDocumentChat(chatEndpoint: string): UseDocumentChatResult {
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

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || loading) return;

      setInput("");
      const newMessages: Message[] = [...messages, { role: "user", content: text }];
      setMessages(newMessages);
      setLoading(true);
      setError(null);

      fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })
        .then(async (res) => {
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
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setMessages((prev) => prev.slice(0, -1));
        })
        .finally(() => setLoading(false));
    },
    [input, loading, messages, chatEndpoint],
  );

  return { messages, input, setInput, loading, error, messagesEndRef, handleSubmit };
}
