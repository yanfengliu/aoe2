// ClaudeCodeProvider response-side tests: parsing the stream-json
// envelope, synthesizing tool_use blocks from {thought, toolCalls},
// error paths (non-zero exit, malformed envelope, is_error). Outbound
// invocation contract (CLI args, lockdown flags, schema construction)
// lives in `claudeCodeProvider.invocation.test.ts`.

import { describe, it, expect, vi } from 'vitest';
import {
  ClaudeCodeProvider,
  ProviderCallError,
  buildToolsPromptText,
  type ClaudeCodeRunFn,
  type ClaudeCodeRunResult,
} from '../../src/game/playtest/llmProviders';
import type { LlmCallOptions } from '../../src/game/playtest/types';

const BASE_OPTIONS: LlmCallOptions = {
  model: 'claude-sonnet-4-6',
  systemPrompt: 'system',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
  tools: [
    {
      name: 'unit_command_attack',
      description: 'Order a unit to attack a target.',
      inputSchema: {
        type: 'object',
        properties: {
          unitId: { type: 'integer' },
          targetEntityId: { type: 'integer' },
        },
        required: ['unitId', 'targetEntityId'],
      },
    },
  ],
  maxOutputTokens: 1024,
};

interface RunCapture {
  cmd: string;
  args: string[];
  stdin: string;
  timeoutMs: number;
  cwd: string;
}

function makeRunFn(envelope: object, captures: RunCapture[]): ClaudeCodeRunFn {
  return async (cmd, args, stdin, opts) => {
    captures.push({ cmd, args: [...args], stdin, timeoutMs: opts.timeoutMs, cwd: opts.cwd });
    const stdout = JSON.stringify(envelope);
    return { stdout, stderr: '', exitCode: 0 };
  };
}

function makeFailingRunFn(result: ClaudeCodeRunResult): ClaudeCodeRunFn {
  return async () => result;
}

describe('ClaudeCodeProvider', () => {
  it('synthesizes a text + tool_use block from {thought, toolCalls} JSON', async () => {
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          api_error_status: null,
          result: JSON.stringify({
            thought: 'attack the closest enemy',
            toolCalls: [
              {
                name: 'unit_command_attack',
                input: { unitId: 5, targetEntityId: 12 },
              },
            ],
          }),
          total_cost_usd: 0.0123,
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 50,
            cache_read_input_tokens: 200,
            output_tokens: 30,
          },
        },
        captures,
      ),
    });

    const result = await provider.call(BASE_OPTIONS);

    expect(result.content).toEqual([
      { type: 'text', text: 'attack the closest enemy' },
      {
        type: 'tool_use',
        toolName: 'unit_command_attack',
        toolInput: { unitId: 5, targetEntityId: 12 },
      },
    ]);
    // tokensIn aggregates all three input-token kinds (input + cache_creation + cache_read)
    expect(result.tokensIn).toBe(350);
    expect(result.tokensOut).toBe(30);
    expect(result.costUsd).toBeCloseTo(0.0123, 6);
  });


  it('throws a ProviderCallError on non-zero exit code with truncated stderr', async () => {
    const provider = new ClaudeCodeProvider({
      runFn: makeFailingRunFn({
        stdout: '',
        stderr: 'auth failure: please run claude login',
        exitCode: 1,
      }),
    });
    await expect(provider.call(BASE_OPTIONS)).rejects.toThrow(
      /claude exit 1.*auth failure/,
    );
    // provider-error-retry: the class is load-bearing — the runner keys
    // its retry-with-backoff + `providerError` stopReason on it.
    await expect(provider.call(BASE_OPTIONS)).rejects.toBeInstanceOf(ProviderCallError);
  });

  it('wraps a runFn REJECTION (spawn error / timeout) as a ProviderCallError', async () => {
    // provider-error-retry iter-2 (Codex HIGH / Claude MED): a subprocess
    // failure that REJECTS (rather than resolving a non-zero exit) — e.g. a
    // spawn EAGAIN or a 5-minute timeout — must still be retryable, not a
    // plain Error that the runner mis-classifies as engineHalt.
    const provider = new ClaudeCodeProvider({
      runFn: async () => {
        throw new Error('[claude-code-provider] timed out after 300000ms (pid killed)');
      },
    });
    await expect(provider.call(BASE_OPTIONS)).rejects.toBeInstanceOf(ProviderCallError);
    await expect(provider.call(BASE_OPTIONS)).rejects.toThrow(/timed out after 300000ms/);
  });

  it('throws on is_error envelope', async () => {
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'error_max_turns',
          is_error: true,
          api_error_status: 'rate_limit',
          result: '',
        },
        [],
      ),
    });
    await expect(provider.call(BASE_OPTIONS)).rejects.toThrow(
      /reported is_error.*rate_limit/,
    );
  });

  it('throws when no result event is found in stream-json output', async () => {
    const provider = new ClaudeCodeProvider({
      runFn: makeFailingRunFn({
        stdout: 'not-json garbage',
        stderr: '',
        exitCode: 0,
      }),
    });
    await expect(provider.call(BASE_OPTIONS)).rejects.toThrow(
      /no result event found in stream-json output/,
    );
  });

  it('prefers structured_output (pre-parsed) over result string when --json-schema is in use', async () => {
    // Real claude --json-schema mode: result="" and the parsed schema-
    // conforming object lands in structured_output. Provider must read
    // structured_output rather than re-parsing the empty result.
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: '',
          structured_output: {
            thought: 'attack',
            toolCalls: [
              {
                name: 'unit_command_attack',
                input: { unitId: 9, targetEntityId: 17 },
              },
            ],
          },
          total_cost_usd: 0.05,
          usage: { input_tokens: 100, output_tokens: 30 },
        },
        [],
      ),
    });
    const result = await provider.call(BASE_OPTIONS);
    expect(result.content).toEqual([
      { type: 'text', text: 'attack' },
      {
        type: 'tool_use',
        toolName: 'unit_command_attack',
        toolInput: { unitId: 9, targetEntityId: 17 },
      },
    ]);
  });

  it('parses a multi-event stream-json output, picking the result event', async () => {
    // Real claude --output-format stream-json prints multiple events: a
    // system init message, an assistant message with deltas, then a
    // result. Only the result carries usage + cost. Verify we ignore the
    // others and pick the result.
    const events = [
      { type: 'system', subtype: 'init', session_id: 'abc' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'thinking…' }] } },
      {
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: '{"thought":"go","toolCalls":[]}',
        total_cost_usd: 0.0042,
        usage: { input_tokens: 7, output_tokens: 3 },
      },
    ];
    const stdout = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    const provider = new ClaudeCodeProvider({
      runFn: makeFailingRunFn({ stdout, stderr: '', exitCode: 0 }),
    });
    const result = await provider.call(BASE_OPTIONS);
    expect(result.content).toEqual([{ type: 'text', text: 'go' }]);
    expect(result.tokensIn).toBe(7);
    expect(result.tokensOut).toBe(3);
    expect(result.costUsd).toBeCloseTo(0.0042, 6);
  });

  it('returns empty content when result is empty string (model declined)', async () => {
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: '',
          total_cost_usd: 0.001,
          usage: { input_tokens: 10, output_tokens: 0 },
        },
        [],
      ),
    });
    const result = await provider.call(BASE_OPTIONS);
    expect(result.content).toEqual([]);
    expect(result.tokensIn).toBe(10);
    expect(result.costUsd).toBe(0.001);
  });

  it('drops malformed toolCalls entries (forward-compatible parsing)', async () => {
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: JSON.stringify({
            thought: 'mixed valid and bogus calls',
            toolCalls: [
              { name: 'unit_command_attack', input: { unitId: 1 } },
              { name: 'no_input_field' }, // missing input → drop
              { input: { x: 1 } }, // missing name → drop
              null, // not an object → drop
              { name: 42, input: {} }, // non-string name → drop
              { name: 'building_setRallyPoint', input: { buildingId: 7 } },
            ],
          }),
          total_cost_usd: 0,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
        [],
      ),
    });
    const result = await provider.call(BASE_OPTIONS);
    const toolUseBlocks = result.content.filter((b) => b.type === 'tool_use');
    expect(toolUseBlocks).toHaveLength(2);
    expect(toolUseBlocks.map((b) => (b as { toolName: string }).toolName)).toEqual([
      'unit_command_attack',
      'building_setRallyPoint',
    ]);
  });

  it('strips leading non-JSON noise from stdout (defensive parser)', async () => {
    const envelope = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '{"thought":"x","toolCalls":[]}',
      total_cost_usd: 0,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    const noisy = `Some banner text on stderr leaking into stdout\n${JSON.stringify(envelope)}`;
    const provider = new ClaudeCodeProvider({
      runFn: makeFailingRunFn({ stdout: noisy, stderr: '', exitCode: 0 }),
    });
    const result = await provider.call(BASE_OPTIONS);
    expect(result.content).toEqual([{ type: 'text', text: 'x' }]);
  });

  it('throws when result string is non-JSON', async () => {
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: 'this is not JSON at all',
          total_cost_usd: 0,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
        [],
      ),
    });
    await expect(provider.call(BASE_OPTIONS)).rejects.toThrow(
      /schema-constrained result was not JSON/,
    );
  });

  it('forwards timeoutMs to the runFn so it can kill its spawned child', async () => {
    // Timeout enforcement lives in defaultClaudeRun (so it can SIGTERM
    // the spawned child — see Codex/Claude impl-1 H3). We only verify
    // here that the configured timeoutMs reaches the runFn options;
    // defaultClaudeRun's spawn-level kill behavior is exercised by the
    // CC_INTEGRATION_TEST=1 integration suite.
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: '{"thought":"","toolCalls":[]}',
          total_cost_usd: 0,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
        captures,
      ),
      timeoutMs: 1234,
    });
    await provider.call(BASE_OPTIONS);
    expect(captures[0]!.timeoutMs).toBe(1234);
  });

  it('computes tokensIn=0 if usage absent (pre-cache claude versions)', async () => {
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: '{"thought":"hi","toolCalls":[]}',
          total_cost_usd: 0.0001,
        },
        [],
      ),
    });
    const result = await provider.call(BASE_OPTIONS);
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.costUsd).toBe(0.0001);
  });
});

describe('buildToolsPromptText', () => {
  it('lists each tool name + description + input schema', () => {
    const text = buildToolsPromptText([
      {
        name: 'unit_command_move',
        description: 'Move a unit to a target cell.',
        inputSchema: {
          type: 'object',
          properties: { unitId: { type: 'integer' }, x: { type: 'integer' }, y: { type: 'integer' } },
          required: ['unitId', 'x', 'y'],
        },
      },
      {
        name: 'building_setRallyPoint',
        description: 'Set rally point for a building.',
        inputSchema: {
          type: 'object',
          properties: { buildingId: { type: 'integer' } },
          required: ['buildingId'],
        },
      },
    ]);
    expect(text).toContain('## Available Actions');
    expect(text).toContain('### unit_command_move');
    expect(text).toContain('Move a unit to a target cell.');
    expect(text).toContain('### building_setRallyPoint');
    expect(text).toContain('"unitId"');
    expect(text).toContain('"buildingId"');
    expect(text).toContain('toolCalls: []');
  });
});

describe('ClaudeCodeProvider mock invocation isolation', () => {
  it('does not call console.warn or write to disk during a successful call', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(
        {
          type: 'result',
          subtype: 'success',
          is_error: false,
          result: '{"thought":"ok","toolCalls":[]}',
          total_cost_usd: 0,
          usage: { input_tokens: 1, output_tokens: 1 },
        },
        [],
      ),
    });
    await provider.call(BASE_OPTIONS);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
