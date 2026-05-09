// Outbound CLI invocation contract for ClaudeCodeProvider.
//
// Pinned here:
//   - args list (model, schema, stream-json, system-prompt-file)
//   - tool-surface lockdown (--permission-mode plan + --strict-mcp-config)
//   - cwd lockdown (no AoE2 CLAUDE.md auto-discovery)
//   - tempfile system-prompt with augmented tool descriptions
//   - schema enum constraints on tool names
//   - stream-json input shape for image blocks
//
// Response-side parsing + error paths live in
// `claudeCodeProvider.test.ts` (sibling).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ClaudeCodeProvider,
  type ClaudeCodeRunFn,
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

const STUB_OK_ENVELOPE = {
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: '{"thought":"","toolCalls":[]}',
  total_cost_usd: 0,
  usage: { input_tokens: 1, output_tokens: 1 },
};

describe('ClaudeCodeProvider — outbound invocation contract', () => {
  it('passes model, system prompt, json-schema, and stream-json input to the CLI', async () => {
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(STUB_OK_ENVELOPE, captures),
    });

    await provider.call(BASE_OPTIONS);

    expect(captures).toHaveLength(1);
    const cap = captures[0]!;
    expect(cap.cmd).toBe('claude');
    expect(cap.args).toContain('-p');
    expect(cap.args).toContain('--output-format');
    expect(cap.args[cap.args.indexOf('--output-format') + 1]).toBe('stream-json');
    expect(cap.args).toContain('--input-format');
    expect(cap.args[cap.args.indexOf('--input-format') + 1]).toBe('stream-json');
    expect(cap.args).toContain('--verbose');
    expect(cap.args).toContain('--model');
    expect(cap.args[cap.args.indexOf('--model') + 1]).toBe('claude-sonnet-4-6');
    expect(cap.args).toContain('--json-schema');
    const schemaStr = cap.args[cap.args.indexOf('--json-schema') + 1]!;
    const schema = JSON.parse(schemaStr) as Record<string, unknown>;
    expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty('thought');
    expect((schema as { properties: Record<string, unknown> }).properties).toHaveProperty('toolCalls');
    // System prompt augmented with tool descriptions, written to a
    // tempfile referenced via --append-system-prompt-file (avoids
    // Windows' 8K command-line limit when the tool count grows).
    expect(cap.args).toContain('--append-system-prompt-file');
    const sysIdx = cap.args.indexOf('--append-system-prompt-file');
    expect(cap.args[sysIdx + 1]).toMatch(/system\.txt$/);
    // Stream-json stdin: one envelope per line, role=user, content blocks preserved
    const lines = cap.stdin.trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'hello' }],
      },
    });
  });

  it('translates outbound image blocks into stream-json source-base64 shape', async () => {
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(STUB_OK_ENVELOPE, captures),
    });

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

    const lines = captures[0]!.stdin.trim().split('\n').map((l) => JSON.parse(l));
    const blocks = (lines[0]!.message.content as Array<Record<string, unknown>>);
    expect(blocks[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' },
    });
    expect(blocks[1]).toEqual({ type: 'text', text: 'Look at this.' });
  });

  it('writes augmented system prompt to a tempfile referenced via flag', async () => {
    const captures: RunCapture[] = [];
    let capturedSystemContent: string | null = null;
    const runFn: ClaudeCodeRunFn = async (cmd, args, stdin, opts) => {
      captures.push({ cmd, args: [...args], stdin, timeoutMs: opts.timeoutMs, cwd: opts.cwd });
      const idx = args.indexOf('--append-system-prompt-file');
      if (idx !== -1) {
        capturedSystemContent = readFileSync(args[idx + 1]!, 'utf8');
      }
      return {
        stdout: JSON.stringify(STUB_OK_ENVELOPE),
        stderr: '',
        exitCode: 0,
      };
    };
    const provider = new ClaudeCodeProvider({ runFn });
    await provider.call(BASE_OPTIONS);
    expect(capturedSystemContent).not.toBeNull();
    expect(capturedSystemContent!).toContain('system'); // original system prompt
    expect(capturedSystemContent!).toContain('## Available Actions');
    expect(capturedSystemContent!).toContain('unit_command_attack');
  });

  it('locks the session — plan mode + strict-mcp-config + no allowedTools', async () => {
    // Three layers of tool-surface lockdown (Claude impl-1 H1):
    // 1. --permission-mode plan: overrides settings.json, makes session read-only.
    // 2. --strict-mcp-config: skips globally-configured MCP servers.
    // 3. No --allowedTools flag: default empty list, no tool can run.
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(STUB_OK_ENVELOPE, captures),
    });

    await provider.call(BASE_OPTIONS);

    const args = captures[0]!.args;
    expect(args).toContain('--permission-mode');
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan');
    expect(args).toContain('--strict-mcp-config');
    expect(args).toContain('--no-session-persistence');
    expect(args).not.toContain('--allowedTools');
    expect(args).not.toContain('--disallowedTools');
  });

  it('runs claude in a temp cwd — no AoE2 CLAUDE.md auto-discovery', async () => {
    // Claude impl-1 H2: spawning claude from the AoE2 repo cwd
    // auto-loads its CLAUDE.md + SessionStart hooks (the superpowers
    // skill text, plugins, etc), doubling per-call cost. The provider
    // creates a fresh tempdir per call AND pins the spawn cwd to it,
    // so claude only sees an empty dir.
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(STUB_OK_ENVELOPE, captures),
    });
    await provider.call(BASE_OPTIONS);
    const cap = captures[0]!;
    const sysPromptIdx = cap.args.indexOf('--append-system-prompt-file');
    const sysPromptPath = cap.args[sysPromptIdx + 1]!;
    expect(sysPromptPath.startsWith(cap.cwd)).toBe(true);
    expect(cap.args).toContain('--exclude-dynamic-system-prompt-sections');
  });

  it('constrains toolCalls[].name to the actual tools enum in the json schema', async () => {
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(STUB_OK_ENVELOPE, captures),
    });

    await provider.call({
      ...BASE_OPTIONS,
      tools: [
        { name: 'tool_a', description: '', inputSchema: { type: 'object', properties: {} } },
        { name: 'tool_b', description: '', inputSchema: { type: 'object', properties: {} } },
      ],
    });

    const args = captures[0]!.args;
    const schemaIdx = args.indexOf('--json-schema');
    const schema = JSON.parse(args[schemaIdx + 1]!) as Record<string, unknown>;
    const items = (schema.properties as Record<string, Record<string, unknown>>).toolCalls.items as
      Record<string, unknown>;
    const nameSchema = (items.properties as Record<string, Record<string, unknown>>).name;
    expect(nameSchema.type).toBe('string');
    expect(nameSchema.enum).toEqual(['tool_a', 'tool_b']);
  });

  it('falls back to free string in the schema when tools[] is empty (avoids invalid empty-enum)', async () => {
    const captures: RunCapture[] = [];
    const provider = new ClaudeCodeProvider({
      runFn: makeRunFn(STUB_OK_ENVELOPE, captures),
    });

    await provider.call({ ...BASE_OPTIONS, tools: [] });

    const args = captures[0]!.args;
    const schemaIdx = args.indexOf('--json-schema');
    const schema = JSON.parse(args[schemaIdx + 1]!) as Record<string, unknown>;
    const items = (schema.properties as Record<string, Record<string, unknown>>).toolCalls.items as
      Record<string, unknown>;
    const nameSchema = (items.properties as Record<string, Record<string, unknown>>).name;
    expect(nameSchema.type).toBe('string');
    expect(nameSchema.enum).toBeUndefined();
  });
});
