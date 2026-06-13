// Anthropic SDK-backed provider. Module is dynamically imported so the
// production app bundle excludes it (the static import would pull
// `@anthropic-ai/sdk` into vite's graph). Instantiate from the runner
// (Node) only; throws if ANTHROPIC_API_KEY is absent.
//
// Per design, secret hygiene: the provider drops the SDK's `request`
// and `error.response` fields from any logged data — only the
// returned content + usage flow back to the trace.

import type {
  LlmCallOptions,
  LlmCallResult,
  LlmContentBlock,
  LlmCostTable,
  LlmMessage,
  LlmProvider,
  LlmToolSchema,
} from '../types';
import { DEFAULT_LLM_COST_TABLE } from '../types';
import { ProviderCallError } from './providerError';

export interface AnthropicProviderConfig {
  apiKey?: string; // defaults to process.env.ANTHROPIC_API_KEY
  costTable?: LlmCostTable;
  // Optional override for the SDK module — tests pass a stub.
  sdkClient?: AnthropicSdkClient;
}

// Minimal SDK shape. Lets tests mock without importing the real SDK.
export interface AnthropicSdkResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id?: string; name: string; input: Record<string, unknown> }
  >;
  usage: { input_tokens: number; output_tokens: number };
}
export interface AnthropicSdkClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: 'user' | 'assistant'; content: unknown }>;
      tools?: Array<{ name: string; description: string; input_schema: unknown }>;
    }): Promise<AnthropicSdkResponse>;
  };
}

export class AnthropicProvider implements LlmProvider {
  private clientPromise: Promise<AnthropicSdkClient>;
  private costTable: LlmCostTable;

  constructor(config: AnthropicProviderConfig = {}) {
    this.costTable = config.costTable ?? DEFAULT_LLM_COST_TABLE;
    if (config.sdkClient) {
      this.clientPromise = Promise.resolve(config.sdkClient);
    } else {
      const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error(
          'AnthropicProvider: ANTHROPIC_API_KEY env var is required (or pass apiKey explicitly).',
        );
      }
      // Dynamic import so vite never bundles the SDK into dist/.
      this.clientPromise = import('@anthropic-ai/sdk').then((mod) => {
        const Anthropic = mod.default;
        return new Anthropic({ apiKey }) as unknown as AnthropicSdkClient;
      });
    }
  }

  async call(options: LlmCallOptions): Promise<LlmCallResult> {
    const client = await this.clientPromise;
    const sdkParams = {
      model: options.model,
      max_tokens: options.maxOutputTokens,
      system: options.systemPrompt,
      messages: options.messages.map(toSdkMessage),
      tools: options.tools.map(toSdkTool),
    };
    let response: AnthropicSdkResponse;
    try {
      response = await client.messages.create(sdkParams);
    } catch (err) {
      // Sanitize SDK errors before rethrow (Codex impl-2 MED4 + Claude
      // impl-2 M4). The Anthropic SDK's APIError carries the request
      // URL, headers (including `x-api-key`), and request body (system
      // prompt + base64 screenshot). Re-throw with only status,
      // message, and request-id so Phase 3's trace logging can
      // serialize the error without leaking secrets.
      // provider-error-retry: a failed SDK call is a transient
      // (rate-limit / overload / network) — tag it so the runner
      // retries with backoff instead of treating it as an engineHalt.
      // iter-2 (Codex HIGH / Claude LOW): attach the SANITIZED error as
      // `cause`, never the raw SDK error — the raw one carries the
      // request URL, headers (incl. `x-api-key`), and body, and Node's
      // default error rendering walks the cause chain (the script's
      // top-level `console.error('fatal:', err)` would print it).
      const sanitized = sanitizeSdkError(err);
      throw new ProviderCallError(sanitized.message, { cause: sanitized });
    }
    const content = response.content
      .map(fromSdkBlock)
      .filter((b): b is NonNullable<ReturnType<typeof fromSdkBlock>> => b !== null);
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const rates = this.costTable[options.model];
    if (!rates) {
      // Unknown model = invisible spend (Codex impl-2 MED1). Fail loud
      // so a typo or new Anthropic model string surfaces immediately
      // instead of silently bypassing the rolling-cost gate.
      throw new Error(
        `AnthropicProvider: model '${options.model}' is not in the cost table; add an entry before calling.`,
      );
    }
    const costUsd =
      (tokensIn / 1_000_000) * rates.inputUsdPerMTok
      + (tokensOut / 1_000_000) * rates.outputUsdPerMTok;
    return { content, tokensIn, tokensOut, costUsd };
  }
}

function sanitizeSdkError(err: unknown): Error {
  // Best-effort extraction of safe fields. Anthropic's APIError shape
  // is { status, message, headers, error: { ... } }. We pull only the
  // status, the human-readable message, and the request-id (if
  // present) — drop everything else.
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    const headers = (err as { headers?: Record<string, string> }).headers;
    const requestId = headers?.['request-id'] ?? headers?.['x-request-id'];
    const safe = new Error(
      `[llm-provider] ${err.name}${status !== undefined ? ` (status=${status})` : ''}: ${err.message}${requestId ? ` (request-id=${requestId})` : ''}`,
    );
    safe.name = 'LlmProviderError';
    return safe;
  }
  return new Error(`[llm-provider] non-Error thrown: ${String(err)}`);
}

function toSdkMessage(m: LlmMessage): { role: 'user' | 'assistant'; content: unknown } {
  return {
    role: m.role,
    content: m.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'image') {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: block.mediaType,
            data: block.base64,
          },
        };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          name: block.toolName,
          input: block.toolInput,
        };
      }
      const _exhaustive: never = block;
      return _exhaustive;
    }),
  };
}

function toSdkTool(tool: LlmToolSchema): {
  name: string;
  description: string;
  input_schema: unknown;
} {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

function fromSdkBlock(
  block: AnthropicSdkResponse['content'][number],
): LlmContentBlock | null {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'tool_use') {
    return { type: 'tool_use', toolName: block.name, toolInput: block.input };
  }
  // Unknown block type (e.g. SDK upgrade adding `thinking`,
  // `redacted_thinking`, `server_tool_use`, `web_search_tool_result`).
  // Skip with a warn — Claude impl-2 M3.
  console.warn(
    `[llm-provider] dropped unknown SDK content block type: ${(block as { type?: unknown }).type ?? 'undefined'}`,
  );
  return null;
}
