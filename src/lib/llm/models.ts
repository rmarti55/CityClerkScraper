/**
 * Centralized LLM model configuration.
 *
 * FAST_MODEL  — cheap, high-throughput tasks (summaries, classification, digests)
 * SMART_MODEL — heavier reasoning tasks (RAG Q&A, document chat)
 *
 * Override via env vars; defaults to Gemini 2.5 Flash for both.
 */

export const FAST_MODEL = process.env.LLM_FAST_MODEL || 'google/gemini-2.5-flash';
export const SMART_MODEL = process.env.LLM_SMART_MODEL || 'google/gemini-2.5-flash';
