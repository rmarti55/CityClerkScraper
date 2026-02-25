/**
 * OpenRouter Embeddings API for RAG (chunk and query vectors).
 */

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

// Well-supported, cost-effective embedding model
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_EMBEDDING_MODEL,
      input: text,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter embeddings error (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) throw new Error("Invalid embeddings response");
  return embedding;
}

/**
 * Embed multiple texts in one request (OpenRouter accepts array input).
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_EMBEDDING_MODEL,
      input: texts,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter embeddings error (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const list = data.data ?? [];
  return list.map((d) => d.embedding).filter(Boolean);
}
