# Document Chat Feature – Full Investigation

This document captures the investigation for adding a “chat with this document” feature on meeting attachment cards, using OpenRouter for the LLM and the CivicClerk API / cached PDFs for document content. **No code changes**—investigation and recommended solution only.

---

## 1. CivicClerk API – GetMeetingFile and plainText

### Current behavior (plainText=false)

- **URL**: `GET https://santafenm.api.civicclerk.com/v1/Meetings/GetMeetingFile(fileId=<id>,plainText=false)`
- **Headers**: `Accept: application/json`
- **Response**: JSON with `blobUri` (Azure Blob URL). App then fetches that URL and receives **PDF bytes**.
- **Implementation**: [src/app/api/file/[id]/route.ts](src/app/api/file/[id]/route.ts) and [src/lib/civicclerk.ts](src/lib/civicclerk.ts) (`getFileUrl(fileId)`).

Docs only state that `GetMeetingFile(fileId, plainText)` exists ([docs/civicclerk-api-endpoints-investigation.md](civicclerk-api-endpoints-investigation.md)); **behavior when `plainText=true` is unknown**.

### Possible behaviors when plainText=true

| Scenario | Meaning | Impact |
|----------|---------|--------|
| A | Same JSON + `blobUri`, but blob content is **plain text** (e.g. extracted from PDF server-side) | Best: fetch blob, use as document text; no PDF parsing in our app. |
| B | API returns **raw text** in response body (no blobUri) | Good: parse response as text; may need different Accept or no JSON parse. |
| C | Same as today (PDF blob) | No benefit; we must extract text ourselves from PDF. |
| D | Error / unsupported / different schema | Fall back to client-side PDF text extraction. |

### Required probe (before implementation)

Run these checks with a **known valid `fileId`** (e.g. from a meeting that has attachments, e.g. “02-19-26 SWMA Agenda” from the UI).

1. **plainText=true with Accept: application/json**
   - `GET https://santafenm.api.civicclerk.com/v1/Meetings/GetMeetingFile(fileId=<FILE_ID>,plainText=true)` with header `Accept: application/json`.
   - Record: status code, response body (JSON with `blobUri`?). If JSON with `blobUri`, fetch that URL and check response `Content-Type` and first bytes (`%PDF-` = PDF, else likely text).
   - Curl: `curl -s -D - -o body.json -H "Accept: application/json" "https://santafenm.api.civicclerk.com/v1/Meetings/GetMeetingFile(fileId=<FILE_ID>,plainText=true)"` (replace `<FILE_ID>` with a real integer).

2. **plainText=true with Accept: text/plain**
   - Same GET URL, header `Accept: text/plain`. Record whether body is raw text or JSON.

3. **Optional: $metadata**
   - `GET https://santafenm.api.civicclerk.com/v1/$metadata` and search for `GetMeetingFile` or `plainText` to see if the OData schema documents the function.

**Outcome**: Document results in this file or in the plan. If Scenario A or B holds, use API text and avoid adding a PDF text-extraction dependency. Otherwise, use in-app PDF extraction (see below).

---

## 2. PDF text extraction (fallback when API does not provide text)

### Current stack

- **pdf-lib**: Already used in [src/app/api/file/[id]/metadata/route.ts](src/app/api/file/[id]/metadata/route.ts) for **page count only**. It does **not** extract text.
- File buffer is available from existing cache (`file-cache/<id>.pdf`) or from the same `fetchFileFromAPI` flow used by the file route.

### Options

| Option | Pros | Cons |
|--------|------|------|
| **pdf-parse** | Simple API, server-side, widely used | Unmaintained (6+ years); no guarantee of compatibility with modern Node/PDFs. |
| **unpdf** | Modern, maintained, zero deps, serverless-friendly; explicit “alternative to pdf-parse”; `extractText(pdf, { mergePages: true })` → `{ totalPages, text }`. | New dependency. |
| **pdfjs-dist** | Full control, Mozilla PDF.js | Heavier; text extraction is secondary to rendering; more setup. unpdf bundles a serverless PDF.js build. |
| **pdfdataextract** | Maintained, pdf-parse-like API | Less widespread than unpdf. |

### Recommendation

- **If CivicClerk with plainText=true returns usable text**: Do **not** add a PDF extraction library; use API text only.
- **If we must extract from PDF**: Add **unpdf**. Use existing file buffer (from disk cache or current fetch). Example usage: `getDocumentProxy(new Uint8Array(buffer))` then `extractText(pdf, { mergePages: true })` → single `text` string.

---

## 3. RAG: chunking, embeddings, retrieval

Documents are large (e.g. 84+ page packets); we do **not** send the full doc in context. Use **text extraction → chunking → embeddings → retrieval** so the model only sees relevant chunks per turn.

### Text extraction

- Same as Section 1–2: CivicClerk `plainText=true` probe first; fallback **unpdf** on PDF buffer. Output: one full-document text string.

### Chunking

- Split extracted text into **chunks** (e.g. by page if we have page boundaries from unpdf, or by token/size with overlap, e.g. ~500–800 tokens, 100 token overlap). Store each chunk with optional metadata (page number, section) for citations later.
- For PDFs, page-based chunking is natural and preserves “where” in the doc; overlap helps avoid splitting mid-sentence.

### Embeddings

- **OpenRouter** exposes an **Embeddings API**: `POST https://openrouter.ai/api/v1/embeddings` (same `OPENROUTER_API_KEY`). Supports multiple embedding models; list via `GET https://openrouter.ai/api/v1/embeddings/models`.
- Use it to embed: (1) each document chunk when the doc is first loaded for chat, (2) the user’s question at query time.
- No separate embedding provider required if we stay on OpenRouter for both chat and embeddings.

### Storage and retrieval

- For “chat with this document” we only need **one document in scope per session**. No persistent vector DB required for v1: on first open (or first message) for a given `fileId`, run extraction → chunking → embed all chunks, then keep **chunk text + vectors in memory** (e.g. in a server-side cache keyed by `fileId` with TTL, or per-request if we re-embed each time and accept latency).
- **Retrieval**: embed the user message, compute similarity (e.g. cosine) against stored chunk vectors, take **top-k** (e.g. 5–10) chunks, pass only those as context to the LLM.
- Optional later: persist embeddings in a vector store (e.g. by `fileId`) to avoid re-embedding on every session.

### RAG flow (per user message)

1. Get document chunks + vectors for this `fileId` (from cache or: extract text → chunk → embed).
2. Embed the user’s message.
3. Retrieve top-k chunks by similarity.
4. Build system prompt: “Answer only from the following excerpts. Say when unsure.” + concatenated chunk text.
5. Call `chatCompletion` with that system message + conversation history; return (or stream) reply.

---

## 4. OpenRouter (chat)

### Current usage

- **Client**: [src/lib/llm/openrouter.ts](src/lib/llm/openrouter.ts) – `chatCompletion(messages, options)`, default model `anthropic/claude-3.5-sonnet`.
- **Existing use**: Committee summaries in [src/lib/llm/summary.ts](src/lib/llm/summary.ts) (system + user message, no document context).

### Streaming

- OpenRouter supports **streaming** via `stream: true` on `/api/v1/chat/completions` (SSE). Optional for v1; can be added later for better UX.

### Recommendation

- Use existing `chatCompletion` for the final answer; **context** is only the **retrieved chunks** (from RAG), not the full doc. Add a small OpenRouter **embeddings** client (or fetch `POST /api/v1/embeddings`) for chunk and query embedding.

---

## 5. Security and validation

- **File IDs**: Integer; validate and reject non-numeric or invalid IDs. Current file route does not check “file belongs to a meeting”; it only checks existence via fetch/cache. For chat, same is acceptable unless product requires stricter access control (e.g. only files attached to public meetings).
- **Document text**: Kept server-side; never send raw document to client; only chat messages and assistant replies are visible to the client.
- **Rate/cost**: Optional later: rate-limit or cap per user/session for `/api/file/[id]/chat`.

---

## 6. Ultimate solution summary (RAG)

| Layer | Decision |
|-------|----------|
| **Document text** | (1) **Probe** CivicClerk `GetMeetingFile(fileId, plainText=true)` (Section 1). (2) If API returns usable text → use it. (3) Else **unpdf** on PDF buffer. |
| **Chunking** | Split extracted text into chunks (e.g. by page or ~500–800 tokens with overlap). |
| **Embeddings** | OpenRouter `POST /api/v1/embeddings` for chunk vectors and query vector; same `OPENROUTER_API_KEY`. |
| **Storage** | Per-session or cache by `fileId`: keep chunk text + vectors in memory; no persistent vector DB for v1. |
| **Retrieval** | Embed user message; similarity search (e.g. cosine) over chunk vectors; take top-k chunks. |
| **Chat API** | `POST /api/file/[id]/chat`: get chunks+vectors (or build from extraction→chunk→embed), retrieve for latest message, system prompt = retrieved chunks only, call `chatCompletion`. |
| **Text API** | `GET /api/file/[id]/text` optional (for debugging or future use); RAG path uses extraction internally when building chunks. |
| **Viewer** | New page `/meeting/[id]/file/[fileId]`: PDF area + chat UI; send messages to chat API. |
| **Entry point** | “Chat” on each attachment card → viewer page. |
| **Dependencies** | **unpdf** (if API text not usable); OpenRouter for both embeddings and chat. |

### Implementation order

1. **Run CivicClerk probe** (Section 1); document result.
2. **Text extraction**: implement extraction (API or unpdf), optionally expose as `GET /api/file/[id]/text`.
3. **Chunking**: split extracted text (page or token-based); produce `{ text, metadata? }[]`.
4. **Embeddings**: add OpenRouter embeddings client; embed chunks on first use per `fileId`, cache chunks+vectors (in-memory or TTL cache).
5. **RAG + Chat API**: `POST /api/file/[id]/chat` — resolve chunks+vectors, embed query, retrieve top-k, build system prompt from chunks, `chatCompletion`.
6. **Viewer page**: PDF + chat UI; “Chat” on attachment cards.

No code in this repo was modified; this document is the investigation and the reference plan for the RAG-based document chat solution.
