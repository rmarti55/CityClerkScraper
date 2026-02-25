import { NextRequest, NextResponse } from "next/server";
import { getChunksWithEmbeddings, retrieveTopK } from "@/lib/document-rag";
import { createEmbedding } from "@/lib/llm/embeddings";
import { chatCompletion, type ChatMessage } from "@/lib/llm/openrouter";

const TOP_K = 8;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = parseInt(id);
  if (isNaN(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Chat is not configured (missing OPENROUTER_API_KEY)" },
      { status: 503 }
    );
  }

  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = (lastUser?.content ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "No user message to answer" }, { status: 400 });
  }

  try {
    const chunks = await getChunksWithEmbeddings(fileId);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Document has no extractable text" },
        { status: 422 }
      );
    }

    const queryEmbedding = await createEmbedding(query);
    const retrieved = retrieveTopK(chunks, queryEmbedding, TOP_K);
    const contextText = retrieved
      .map((r) => (r.page != null ? `[Page ${r.page}]\n${r.text}` : r.text))
      .join("\n\n---\n\n");

    const systemContent =
      `Answer based only on the following excerpts from the document. If the answer is not in the excerpts, say so. Do not make up information.\n\n` +
      `Excerpts:\n\n${contextText}`;

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemContent },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
    ];

    const { content, model } = await chatCompletion(chatMessages, {
      temperature: 0.3,
      maxTokens: 1024,
    });

    return NextResponse.json({ content, model });
  } catch (e) {
    console.error("Chat error for file", fileId, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 }
    );
  }
}
