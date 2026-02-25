/**
 * PDF text extraction and chunking for RAG.
 */

import { extractText, getDocumentProxy } from "unpdf";

export interface TextChunk {
  text: string;
  page?: number;
}

/**
 * Extract text from a PDF buffer. Returns per-page text for chunking.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pages: string[] }> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: false });
  const pages = result.text;
  const text = pages.join("\n\n");
  return { text, pages };
}

const MAX_CHUNK_CHARS = 2000;
const OVERLAP_CHARS = 200;

/**
 * Build chunks from extracted page texts. One chunk per page by default;
 * split long pages into overlapping chunks.
 */
export function chunkDocument(pages: string[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i]?.trim() ?? "";
    const pageNum = i + 1;
    if (pageText.length <= MAX_CHUNK_CHARS) {
      chunks.push({ text: pageText, page: pageNum });
      continue;
    }
    let start = 0;
    while (start < pageText.length) {
      let end = Math.min(start + MAX_CHUNK_CHARS, pageText.length);
      if (end < pageText.length) {
        const lastSpace = pageText.lastIndexOf(" ", end);
        if (lastSpace > start) end = lastSpace;
      }
      chunks.push({ text: pageText.slice(start, end).trim(), page: pageNum });
      start = end - (end - start > OVERLAP_CHARS ? OVERLAP_CHARS : 0);
      if (start >= pageText.length) break;
    }
  }
  return chunks.filter((c) => c.text.length > 0);
}
