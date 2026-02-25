/**
 * OpenRouter API client
 * Provides access to multiple LLM providers through a single API
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default model - can be overridden per request
const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

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

/**
 * Send a chat completion request to OpenRouter
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

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Santa Fe City Clerk Dashboard',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
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

/**
 * Simple text completion helper
 */
export async function complete(
  prompt: string,
  options: CompletionOptions = {}
): Promise<{ content: string; model: string }> {
  return chatCompletion([{ role: 'user', content: prompt }], options);
}
