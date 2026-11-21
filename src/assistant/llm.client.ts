import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const LLM_TIMEOUT_MS = 30_000;

export interface ChatOptions {
  /** Time budget for the whole call, across every model tried (default: LLM_TIMEOUT_MS per model). */
  timeoutMs?: number;
}

/**
 * Minimal client for any OpenAI-compatible chat endpoint (Ollama, Groq,
 * OpenRouter, LM Studio, vLLM...). Configured by LLM_BASE_URL, LLM_API_KEY and
 * LLM_MODEL; without LLM_BASE_URL and LLM_MODEL it reports itself as not
 * configured and the assistant answers extractively.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  /** LLM_MODEL may list several models separated by commas; they are tried in order. */
  private readonly models: string[];

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('LLM_BASE_URL')?.replace(/\/+$/, '');
    this.apiKey = config.get<string>('LLM_API_KEY');
    this.models = (config.get<string>('LLM_MODEL') ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }

  get configured(): boolean {
    return Boolean(this.baseUrl && this.models.length > 0);
  }

  /**
   * Returns the reply text, or null when not configured or every model fails.
   * Free hosted models are often rate-limited, so each configured model is
   * tried in turn.
   */
  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<string | null> {
    if (!this.configured) return null;
    const deadline =
      options.timeoutMs === undefined ? null : Date.now() + options.timeoutMs;
    for (const model of this.models) {
      const timeout =
        deadline === null
          ? LLM_TIMEOUT_MS
          : Math.min(deadline - Date.now(), LLM_TIMEOUT_MS);
      if (timeout <= 0) break;
      const text = await this.chatWith(model, messages, timeout);
      if (text) return text;
    }
    return null;
  }

  private async chatWith(
    model: string,
    messages: ChatMessage[],
    timeout: number,
  ): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          // Reasoning models spend part of the budget before the answer.
          max_tokens: 2500,
        }),
        signal: AbortSignal.timeout(timeout),
      });
      const raw = await res.text();
      if (!res.ok) {
        this.logger.warn(
          `LLM ${model} HTTP ${res.status}: ${raw.slice(0, 200)}`,
        );
        return null;
      }
      // Some providers emit raw control characters inside JSON strings.
      // eslint-disable-next-line no-control-regex
      const data = JSON.parse(raw.replace(/[\u0000-\u001f]/g, ' ')) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) this.logger.warn(`LLM ${model} returned an empty answer`);
      return text ? text : null;
    } catch (error) {
      this.logger.warn(`LLM ${model} call failed: ${String(error)}`);
      return null;
    }
  }
}
