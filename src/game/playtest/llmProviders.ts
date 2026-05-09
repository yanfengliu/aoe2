// LlmProvider implementations: a mock provider for tests + a stub for
// the Anthropic SDK provider that Phase 2.B will fill in. The agent's
// decide() loop only depends on the LlmProvider interface in types.ts.

import type {
  LlmCallOptions,
  LlmCallResult,
  LlmContentBlock,
  LlmCostTable,
  LlmProvider,
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
