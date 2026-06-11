import { describe, it, expect, vi } from 'vitest';
import {
  AnthropicProvider,
  type AnthropicSdkClient,
  type AnthropicSdkResponse,
} from '../../src/game/playtest/llmProviders';
import type { LlmCallOptions } from '../../src/game/playtest/types';

function makeStubClient(response: AnthropicSdkResponse): {
  client: AnthropicSdkClient;
  receivedParams: Array<Parameters<AnthropicSdkClient['messages']['create']>[0]>;
} {
  const receivedParams: Array<Parameters<AnthropicSdkClient['messages']['create']>[0]> = [];
  const client: AnthropicSdkClient = {
    messages: {
      async create(params) {
        receivedParams.push(params);
        return response;
      },
    },
  };
  return { client, receivedParams };
}

const BASE_OPTIONS: LlmCallOptions = {
  model: 'claude-sonnet-4-6',
  systemPrompt: 'system',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
  tools: [
    {
      name: 'unit_move',
      description: 'Move',
      inputSchema: {
        type: 'object',
        properties: { unitId: { type: 'integer' } },
        required: ['unitId'],
      },
    },
  ],
  maxOutputTokens: 1024,
};

describe('AnthropicProvider', () => {
  it('translates outbound text + image + tool blocks to SDK shape', async () => {
    const { client, receivedParams } = makeStubClient({
      content: [{ type: 'text', text: 'ack' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    await provider.call({
      ...BASE_OPTIONS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', base64: 'iVBORw0KGgo=', mediaType: 'image/png' },
            { type: 'text', text: 'Look at this.' },
          ],
        },
      ],
    });
    expect(receivedParams).toHaveLength(1);
    const params = receivedParams[0]!;
    const blocks = (params.messages[0]!.content as Array<Record<string, unknown>>);
    expect(blocks[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' },
    });
    expect(blocks[1]).toEqual({ type: 'text', text: 'Look at this.' });
  });

  it('translates SDK text + tool_use response back to LlmContentBlock', async () => {
    const { client } = makeStubClient({
      content: [
        { type: 'text', text: 'doing it' },
        { type: 'tool_use', name: 'unit_move', input: { unitId: 5, target: { x: 1, y: 1 } } },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    const result = await provider.call(BASE_OPTIONS);
    expect(result.content).toEqual([
      { type: 'text', text: 'doing it' },
      { type: 'tool_use', toolName: 'unit_move', toolInput: { unitId: 5, target: { x: 1, y: 1 } } },
    ]);
    expect(result.tokensIn).toBe(100);
    expect(result.tokensOut).toBe(50);
  });

  it('computes costUsd from the cost table', async () => {
    const { client } = makeStubClient({
      content: [{ type: 'text', text: 'x' }],
      usage: { input_tokens: 1_000_000, output_tokens: 500_000 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    const result = await provider.call({ ...BASE_OPTIONS, model: 'claude-sonnet-4-6' });
    // Sonnet: $3/Mtok in × 1M = $3 + $15/Mtok out × 500k = $7.5 → $10.50
    expect(result.costUsd).toBeCloseTo(10.5, 4);
  });

  it('prices claude-fable-5 at $10/$50 per MTok (the playtest-standard model)', async () => {
    const { client } = makeStubClient({
      content: [{ type: 'text', text: 'x' }],
      usage: { input_tokens: 1_000_000, output_tokens: 500_000 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    const result = await provider.call({ ...BASE_OPTIONS, model: 'claude-fable-5' });
    // Fable 5: $10/MTok in × 1M = $10 + $50/MTok out × 500k = $25 → $35.00
    expect(result.costUsd).toBeCloseTo(35.0, 4);
  });

  it('throws for unknown model (silent invisible-spend guard)', async () => {
    const { client } = makeStubClient({
      content: [{ type: 'text', text: 'x' }],
      usage: { input_tokens: 1_000_000, output_tokens: 500_000 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    await expect(
      provider.call({ ...BASE_OPTIONS, model: 'not-a-real-model' }),
    ).rejects.toThrow(/not in the cost table/);
  });

  it('translates outbound tool schemas to SDK shape', async () => {
    const { client, receivedParams } = makeStubClient({
      content: [{ type: 'text', text: 'x' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    await provider.call(BASE_OPTIONS);
    const tools = receivedParams[0]!.tools!;
    expect(tools).toHaveLength(1);
    expect(tools[0]).toEqual({
      name: 'unit_move',
      description: 'Move',
      input_schema: {
        type: 'object',
        properties: { unitId: { type: 'integer' } },
        required: ['unitId'],
      },
    });
  });

  it('throws when ANTHROPIC_API_KEY is empty AND no sdkClient passed', () => {
    const oldKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new AnthropicProvider()).toThrow(/ANTHROPIC_API_KEY/);
    if (oldKey !== undefined) process.env.ANTHROPIC_API_KEY = oldKey;
  });

  it('sanitizes SDK errors — drops request body, headers, and api key', async () => {
    // Construct an Anthropic-style APIError with sensitive fields.
    const sdkError = Object.assign(new Error('API rejected'), {
      name: 'APIError',
      status: 401,
      headers: {
        'x-api-key': 'sk-ant-secret-xyz',
        'request-id': 'req_abc123',
      },
      request: { body: { systemPrompt: 'leaked', messages: [] } },
    });
    const client: AnthropicSdkClient = {
      messages: {
        async create() {
          throw sdkError;
        },
      },
    };
    const provider = new AnthropicProvider({ sdkClient: client });
    let caught: Error | null = null;
    try {
      await provider.call(BASE_OPTIONS);
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    const stringified = `${caught!.name}: ${caught!.message}\n${(caught as { stack?: string }).stack ?? ''}`;
    expect(stringified).not.toContain('sk-ant-secret-xyz');
    expect(stringified).not.toContain('x-api-key');
    expect(stringified).not.toContain('leaked'); // request body
    expect(caught!.message).toContain('status=401');
    expect(caught!.message).toContain('request-id=req_abc123');
  });

  it('drops unknown SDK content block types with a warn (forward-compat)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeStubClient({
      content: [
        { type: 'text', text: 'visible' },
        // Future SDK might emit `thinking`, `web_search_tool_result`,
        // etc. We don't statically know the type — cast through any.
        { type: 'thinking', text: 'hidden' } as unknown as AnthropicSdkResponse['content'][number],
        { type: 'tool_use', name: 'unit_move', input: { unitId: 1 } },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    const result = await provider.call(BASE_OPTIONS);
    expect(result.content).toHaveLength(2); // unknown block dropped
    expect(result.content.map((c) => c.type)).toEqual(['text', 'tool_use']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('thinking'));
    warn.mockRestore();
  });

  it('forwards system prompt + max_tokens to the SDK', async () => {
    const { client, receivedParams } = makeStubClient({
      content: [{ type: 'text', text: 'x' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const provider = new AnthropicProvider({ sdkClient: client });
    await provider.call({ ...BASE_OPTIONS, systemPrompt: 'be helpful', maxOutputTokens: 512 });
    expect(receivedParams[0]!.system).toBe('be helpful');
    expect(receivedParams[0]!.max_tokens).toBe(512);
  });
});
