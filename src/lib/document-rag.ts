/**
 * In-memory cache of chunked + embedded document content per fileId.
 * Used by the chat API to avoid re-extracting and re-embedding on every message.
 */

import { getPdfBuffer } from "@/lib/file-cache";
import { extractTextFromPdf, chunkDocument, type TextChunk } from "@/lib/document-text";
import { createEmbeddings } from "@/lib/llm/embeddings";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedChunk {
  text: string;
  page?: number;
  embedding: number[];
}

interface CacheEntry {
  chunks: CachedChunk[];
  expiresAt: number;
}

const cache = new Map<number, CacheEntry>();

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface RAGChunk {
  text: string;
  page?: number;
}

/**
 * Get chunks with embeddings for a file, from cache or by extracting + chunking + embedding.
 */
export async function getChunksWithEmbeddings(fileId: number): Promise<CachedChunk[]> {
  const now = Date.now();
  const entry = cache.get(fileId);
  if (entry && entry.expiresAt > now) {
    return entry.chunks;
  }

  const buffer = await getPdfBuffer(fileId);
  if (!buffer) throw new Error("Failed to load file");

  const { pages } = await extractTextFromPdf(buffer);
  const textChunks = chunkDocument(pages);
  if (textChunks.length === 0) return [];

  const texts = textChunks.map((c) => c.text);
  const embeddings = await createEmbeddings(texts);

  const chunks: CachedChunk[] = textChunks.map((tc, i) => ({
    text: tc.text,
    page: tc.page,
    embedding: embeddings[i] ?? [],
  }));

  cache.set(fileId, {
    chunks,
    expiresAt: now + CACHE_TTL_MS,
  });

  return chunks;
}

/**
 * Retrieve top-k chunks most similar to the query embedding.
 */
export function retrieveTopK(
  chunks: CachedChunk[],
  queryEmbedding: number[],
  k: number = 8
): RAGChunk[] {
  const scored = chunks
    .map((c) => ({ chunk: c, score: cosineSimilarity(c.embedding, queryEmbedding) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => ({ text: s.chunk.text, page: s.chunk.page }));
}
