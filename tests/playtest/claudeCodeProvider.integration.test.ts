// Integration test: ClaudeCodeProvider against the real `claude` CLI.
// Skipped by default — opt in with `CC_INTEGRATION_TEST=1` since each
// run hits the user's Claude Code subscription and costs ~$0.05+.
//
// Catches contract regressions that the mock unit tests can't see:
//   - --json-schema actually populates structured_output (vs falling
//     back to .result)
//   - stream-json INPUT requires stream-json OUTPUT
//   - --verbose required for stream-json output with --print
//   - .cmd shim hangs under shell:true (we resolve to .exe)
//
// The provider's `extractSchemaResult` prefers `structured_output` over
// `JSON.parse(result)` (claudeCodeProvider.ts), so seeing a well-formed
// tool_use block here proves either path is working — but we add a
// dedicated assertion for that contract via a runFn wrapper that
// captures the raw envelope (Codex impl-2 LOW).

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import {
  ClaudeCodeProvider,
  resolveClaudeBinary,
  type ClaudeCodeRunFn,
  type ClaudeCodeRunResult,
} from '../../src/game/playtest/llmProviders';

const RUN_INTEGRATION = process.env.CC_INTEGRATION_TEST === '1';
const describeOrSkip = RUN_INTEGRATION ? describe : describe.skip;

describeOrSkip('ClaudeCodeProvider — real CLI integration', () => {
  it('emits a tool_use block via structured_output from a schema-constrained call', async () => {
    // Wrap the default spawn so we can inspect the raw envelope and
    // confirm `structured_output` (not `result`) carried the parsed
    // schema-conforming shape — the path Codex impl-2 LOW asked us to
    // pin.
    let rawStdout = '';
    const runFn: ClaudeCodeRunFn = async (cmd, args, stdin, opts) => {
      const resolved = resolveClaudeBinary(cmd) ?? cmd;
      return new Promise<ClaudeCodeRunResult>((resolve, reject) => {
        const proc = spawn(resolved, args as string[], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          cwd: opts.cwd,
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => proc.kill('SIGTERM'), opts.timeoutMs);
        proc.stdout.on('data', (c) => (stdout += c.toString('utf8')));
        proc.stderr.on('data', (c) => (stderr += c.toString('utf8')));
        proc.on('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
        proc.on('close', (code) => {
          clearTimeout(timer);
          rawStdout = stdout;
          resolve({ stdout, stderr, exitCode: code ?? -1 });
        });
        proc.stdin.write(stdin, 'utf8');
        proc.stdin.end();
      });
    };

    const provider = new ClaudeCodeProvider({ runFn });
    const result = await provider.call({
      model: 'claude-sonnet-4-6',
      systemPrompt:
        'You are a test agent. Pick exactly one tool call: `say_hi` with input {name: "world"}.',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Greet the world.' }] },
      ],
      tools: [
        {
          name: 'say_hi',
          description: 'Say hi to a name.',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      ],
      maxOutputTokens: 256,
    });

    const toolUse = result.content.find((b) => b.type === 'tool_use');
    expect(toolUse).toBeDefined();
    if (toolUse?.type === 'tool_use') {
      expect(toolUse.toolName).toBe('say_hi');
      expect(toolUse.toolInput).toMatchObject({ name: 'world' });
    }

    expect(result.tokensIn).toBeGreaterThan(0);
    expect(result.tokensOut).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThanOrEqual(0);

    // Pin the structured_output contract: the result event must carry
    // a parsed `structured_output` field with our schema's shape, NOT
    // an empty `result` string fallback.
    const resultLine = rawStdout
      .split(/\r?\n/)
      .find((l) => l.startsWith('{"type":"result"'));
    expect(resultLine).toBeDefined();
    const envelope = JSON.parse(resultLine!) as {
      result?: string;
      structured_output?: { thought?: string; toolCalls?: unknown[] };
    };
    expect(envelope.structured_output).toBeDefined();
    expect(envelope.structured_output!.toolCalls).toBeInstanceOf(Array);
    expect(envelope.structured_output!.toolCalls!.length).toBeGreaterThan(0);
  }, 90_000);
});
