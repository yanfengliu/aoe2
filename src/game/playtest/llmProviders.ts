// LlmProvider implementations: a mock provider for tests + an Anthropic
// SDK-backed provider for the runner. The agent's decide() loop only
// depends on the LlmProvider interface in types.ts.

import type {
  LlmCallOptions,
  LlmCallResult,
  LlmContentBlock,
  LlmCostTable,
  LlmMessage,
  LlmProvider,
  LlmToolSchema,
} from './types';
import { DEFAULT_LLM_COST_TABLE } from './types';

export interface MockProviderConfig {
  // Pre-baked responses returned in FIFO order. If a call exceeds the
  // queue length, the provider throws — tests should always queue
  // exactly the responses they expect.
  responses: Array<MockProviderResponse>;
  costTable?: LlmCostTable;
}

export interface MockProviderResponse {
  content: LlmContentBlock[];
  tokensIn?: number;
  tokensOut?: number;
}

export class MockProvider implements LlmProvider {
  private queue: MockProviderResponse[];
  private costTable: LlmCostTable;
  private callCount = 0;

  constructor(config: MockProviderConfig) {
    this.queue = [...config.responses];
    this.costTable = config.costTable ?? DEFAULT_LLM_COST_TABLE;
  }

  // Useful for tests that want to inspect the prompts sent.
  readonly receivedCalls: Array<LlmCallOptions> = [];

  async call(options: LlmCallOptions): Promise<LlmCallResult> {
    this.receivedCalls.push(options);
    const response = this.queue.shift();
    if (!response) {
      throw new Error(
        `MockProvider: no queued response for call #${this.callCount + 1} (model=${options.model})`,
      );
    }
    this.callCount += 1;
    const tokensIn = response.tokensIn ?? estimateInputTokens(options);
    const tokensOut = response.tokensOut ?? estimateOutputTokens(response.content);
    const rates = this.costTable[options.model] ?? { inputUsdPerMTok: 0, outputUsdPerMTok: 0 };
    const costUsd =
      (tokensIn / 1_000_000) * rates.inputUsdPerMTok
      + (tokensOut / 1_000_000) * rates.outputUsdPerMTok;
    return { content: response.content, tokensIn, tokensOut, costUsd };
  }
}

function estimateInputTokens(opts: LlmCallOptions): number {
  // Rough character-based estimate. Claude's tokenizer is ~4 chars/tok
  // for English; for tool definitions it's ~3 chars/tok. We do not
  // count image tokens — the real SDK reports usage that captures them.
  let chars = opts.systemPrompt.length;
  for (const m of opts.messages) {
    for (const c of m.content) {
      if (c.type === 'text') chars += c.text.length;
      else if (c.type === 'image') chars += 1568 * 4; // ~claude image-token cost as chars
      else chars += JSON.stringify(c.toolInput).length;
    }
  }
  for (const t of opts.tools) {
    chars += t.name.length + t.description.length + JSON.stringify(t.inputSchema).length;
  }
  return Math.ceil(chars / 4);
}

function estimateOutputTokens(content: LlmContentBlock[]): number {
  let chars = 0;
  for (const c of content) {
    if (c.type === 'text') chars += c.text.length;
    else if (c.type === 'tool_use') chars += JSON.stringify(c.toolInput).length;
  }
  return Math.ceil(chars / 4);
}

// Anthropic SDK-backed provider. Module is dynamically imported so the
// production app bundle excludes it (the static import would pull
// `@anthropic-ai/sdk` into vite's graph). Instantiate from the runner
// (Node) only; throws if ANTHROPIC_API_KEY is absent.
//
// Per design, secret hygiene: the provider drops the SDK's `request`
// and `error.response` fields from any logged data — only the
// returned content + usage flow back to the trace.

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
      throw sanitizeSdkError(err);
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
