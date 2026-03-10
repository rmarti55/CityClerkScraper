import { NextRequest, NextResponse } from "next/server";
import { getAttachmentPdfBuffer } from "@/lib/file-cache";
import { extractTextFromPdf, chunkDocument } from "@/lib/document-text";
import { createEmbeddings, createEmbedding } from "@/lib/llm/embeddings";
import { retrieveTopK } from "@/lib/document-rag";
import { chatCompletion, type ChatMessage } from "@/lib/llm/openrouter";

const TOP_K = 8;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedChunk {
  text: string;
  page?: number;
  embedding: number[];
}

interface CacheEntry {
  chunks: CachedChunk[];
  expiresAt: number;
}

const attachmentChunkCache = new Map<string, CacheEntry>();

async function getAttachmentChunks(attachmentId: number, agendaId: number): Promise<CachedChunk[]> {
  const cacheKey = `attachment-${attachmentId}`;
  const now = Date.now();
  const entry = attachmentChunkCache.get(cacheKey);
  if (entry && entry.expiresAt > now) return entry.chunks;

  const buffer = await getAttachmentPdfBuffer(attachmentId, agendaId);
  if (!buffer) throw new Error("Failed to load attachment");

  const { pages } = await extractTextFromPdf(buffer);
  const textChunks = chunkDocument(pages);
  if (textChunks.length === 0) return [];

  const embeddings = await createEmbeddings(textChunks.map((c) => c.text));
  const chunks: CachedChunk[] = textChunks.map((tc, i) => ({
    text: tc.text,
    page: tc.page,
    embedding: embeddings[i] ?? [],
  }));

  attachmentChunkCache.set(cacheKey, { chunks, expiresAt: now + CACHE_TTL_MS });
  return chunks;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attachmentId = parseInt(id);
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });
  }

  const agendaIdParam = request.nextUrl.searchParams.get("agendaId");
  const agendaId = agendaIdParam ? parseInt(agendaIdParam) : NaN;
  if (isNaN(agendaId)) {
    return NextResponse.json({ error: "agendaId query param required" }, { status: 400 });
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
    const chunks = await getAttachmentChunks(attachmentId, agendaId);
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
    console.error("Chat error for attachment", attachmentId, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 }
    );
  }
}
