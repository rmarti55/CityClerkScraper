/**
 * OpenRouter API client
 * Provides access to multiple LLM providers through a single API.
 * Includes automatic retries with exponential backoff for transient failures.
 */

import { SITE_NAME } from '@/lib/branding';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

const MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([402, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OpenRouterError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`OpenRouter API error (${status}): ${body}`);
    this.name = 'OpenRouterError';
    this.status = status;
  }
}

/**
 * Send a chat completion request to OpenRouter with automatic retries.
 * Retries on 402 (credits), 429 (rate limit), and 5xx (server errors)
 * with exponential backoff (1s, 4s, 16s).
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<{ content: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const model = options.model || DEFAULT_MODEL;
  const body = JSON.stringify({
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(4, attempt) * 250; // 1s, 4s, 16s
      console.warn(`OpenRouter retry ${attempt}/${MAX_RETRIES - 1} after ${delay}ms (model: ${model})`);
      await sleep(delay);
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': SITE_NAME,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastError = new OpenRouterError(response.status, errorText);

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES - 1) {
        continue;
      }
      throw lastError;
    }

    const data: OpenRouterResponse = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenRouter API');
    }

    return {
      content: data.choices[0].message.content,
      model: data.model || model,
    };
  }

  throw lastError ?? new Error('OpenRouter request failed after retries');
}

/**
 * Simple text completion helper
 */
export async function complete(
  prompt: string,
  options: CompletionOptions = {}
): Promise<{ content: string; model: string }> {
  return chatCompletion([{ role: 'user', content: prompt }], options);
}
