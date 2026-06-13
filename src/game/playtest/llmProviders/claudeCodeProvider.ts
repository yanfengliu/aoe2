// ClaudeCodeProvider: shells out to the `claude -p` CLI rather than the
// Anthropic SDK. Auth is whatever Claude Code is configured with —
// typically the user's subscription via OAuth/keychain, no API key
// required. This is the default provider when ANTHROPIC_API_KEY is
// absent.
//
// We use --output-format stream-json (multi-event), --input-format
// stream-json (multimodal: text + base64 images), and --json-schema
// to constrain the model's output to {thought, toolCalls[]}. The
// provider then synthesizes tool_use blocks so the LlmAgent can keep
// reading the same content shape that AnthropicProvider returns.
//
// Cost reporting comes from the envelope's `total_cost_usd` (notional
// API-equivalent — actual subscription billing is flat). Token counts
// come from the envelope's `usage`. No cost table needed.

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  LlmCallOptions,
  LlmCallResult,
  LlmContentBlock,
  LlmProvider,
  LlmToolSchema,
} from '../types';
import { ProviderCallError } from './providerError';

export interface ClaudeCodeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ClaudeCodeRunOptions {
  // Wall-clock cap for the entire run (spawn + wait). Implementations
  // MUST kill the spawned process when this fires, not just reject the
  // promise — otherwise the orphan child keeps streaming bytes after
  // the JS caller has given up (Codex impl-1 H3).
  timeoutMs: number;
  // Working directory for the spawned claude process. Pinning to a
  // fresh tmp dir prevents claude from auto-discovering CLAUDE.md /
  // AGENTS.md and firing SessionStart hooks that load extraneous
  // skills/plugins (Claude impl-1 H2).
  cwd: string;
}

export type ClaudeCodeRunFn = (
  cmd: string,
  args: readonly string[],
  stdinPayload: string,
  options: ClaudeCodeRunOptions,
) => Promise<ClaudeCodeRunResult>;

export interface ClaudeCodeProviderConfig {
  // Path to the `claude` binary. Defaults to 'claude' on PATH.
  claudeBinPath?: string;
  // Optional override for the spawn implementation — tests pass a
  // canned-output stub.
  runFn?: ClaudeCodeRunFn;
  // Per-call timeout in ms. Default 5 minutes — Sonnet calls usually
  // finish in <30s but Opus can take longer.
  timeoutMs?: number;
}

interface ClaudeCodeOutputEnvelope {
  type: string;
  subtype: string;
  is_error: boolean;
  api_error_status?: string | null;
  // When --json-schema is set, the model's schema-conforming output
  // arrives pre-parsed in `structured_output`; the `result` field is
  // empty in that mode. Without --json-schema, `result` carries the
  // text response and `structured_output` is absent. We tolerate both.
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
  };
}

interface ClaudeCodeResponseShape {
  thought: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
// SIGTERM grace period before escalating to SIGKILL when the timeout
// fires. 1s is enough for a cooperative claude shutdown; longer waits
// would let the orphan keep streaming bytes after we already gave up.
const TIMEOUT_KILL_ESCALATION_MS = 1000;

export class ClaudeCodeProvider implements LlmProvider {
  private claudeBinPath: string;
  private runFn: ClaudeCodeRunFn;
  private timeoutMs: number;

  constructor(config: ClaudeCodeProviderConfig = {}) {
    this.claudeBinPath = config.claudeBinPath ?? 'claude';
    this.runFn = config.runFn ?? defaultClaudeRun;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async call(options: LlmCallOptions): Promise<LlmCallResult> {
    // Schema constrains tool names to the actual `tools` list — Codex
    // impl-1 MED 4 (avoids paying for an LLM call that picks a tool
    // name the dispatcher will reject anyway).
    const responseSchema = buildClaudeCodeResponseSchema(options.tools);
    // The claude CLI (as of 2.1.x) has no `--max-output-tokens` flag —
    // the model uses its own defaults (32K out for Sonnet). To honor
    // the LlmCallOptions.maxOutputTokens contract under that limitation
    // (Codex impl-2 M1), we embed it as a soft instruction in the
    // system prompt. The model usually respects "respond in <= N
    // tokens" hints, though it's not enforced by the runtime.
    const tokenHint = `Constrain your response to roughly ${options.maxOutputTokens} output tokens or fewer.`;
    const augmentedSystem = options.systemPrompt
      + '\n\n'
      + buildToolsPromptText(options.tools)
      + '\n\n'
      + tokenHint;

    // Build stream-json input — one JSON envelope per line.
    const streamLines = options.messages.map((m) =>
      JSON.stringify({
        type: 'user',
        message: {
          role: m.role,
          content: m.content.map(toCcInputBlock),
        },
      }),
    );
    const stdinPayload = streamLines.join('\n') + '\n';

    // System prompt routes through a tempfile via
    // --append-system-prompt-file. With 15 GameCommands tool schemas
    // embedded, the augmented prompt easily clears Windows' 8191-char
    // cmd-line limit; the file approach side-steps that and makes the
    // arg list trivially small.
    const tmpDir = mkdtempSync(join(tmpdir(), 'claude-cc-'));
    const sysPromptFile = join(tmpDir, 'system.txt');
    writeFileSync(sysPromptFile, augmentedSystem, 'utf8');

    // Tool-surface lockdown (Claude impl-1 H1):
    // - `--permission-mode plan` overrides the user's settings.json so
    //   acceptEdits/auto/bypassPermissions can't inadvertently let the
    //   model invoke tools.
    // - `--strict-mcp-config` skips globally-configured MCP servers
    //   (Mermaid Chart, Google Drive, etc).
    // - We do NOT pass `--allowedTools`, so the default empty list
    //   takes effect — no tool can run regardless of permission mode.
    //
    // Per-machine context lockdown (Claude impl-1 H2):
    // - `cwd: tmpDir` on spawn (handled in defaultClaudeRun) avoids
    //   AoE2 CLAUDE.md auto-discovery and `SessionStart` hooks loading
    //   `superpowers` skill, plugins, etc. ~Halves cache_creation tokens
    //   per call (verified live: 31707 → 15158).
    // - `--exclude-dynamic-system-prompt-sections` drops the per-machine
    //   cwd/env/git-status block (small further cache savings).
    //
    // Stream protocol notes:
    // - Stream-json INPUT requires stream-json OUTPUT (claude CLI
    //   constraint), and stream-json output with --print requires
    //   --verbose.
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--model', options.model,
      '--json-schema', JSON.stringify(responseSchema),
      '--append-system-prompt-file', sysPromptFile,
      '--permission-mode', 'plan',
      '--strict-mcp-config',
      '--exclude-dynamic-system-prompt-sections',
      '--no-session-persistence',
    ];

    let runResult: ClaudeCodeRunResult;
    try {
      runResult = await this.runFn(
        this.claudeBinPath,
        args,
        stdinPayload,
        { timeoutMs: this.timeoutMs, cwd: tmpDir },
      );
    } catch (err) {
      // provider-error-retry iter-2 (Codex HIGH / Claude MED): the runFn
      // IS the subprocess call, so ANY rejection from it — a spawn error
      // (transient EAGAIN), a timeout, or the campaign-3 `claude exit 1`
      // path — is a provider-call failure, not an engine crash. Tag it so
      // the runner retries + classifies it as `providerError` instead of
      // `engineHalt`. (Node spawn/timeout errors carry no secrets, so
      // preserving the cause is safe here — unlike the Anthropic SDK path.)
      throw err instanceof ProviderCallError
        ? err
        : new ProviderCallError(
            err instanceof Error ? err.message : String(err),
            { cause: err },
          );
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Best effort — temp cleanup failure shouldn't mask provider error.
      }
    }

    if (runResult.exitCode !== 0) {
      throw new ProviderCallError(
        `[claude-code-provider] claude exit ${runResult.exitCode}: `
          + `${truncate(runResult.stderr, 500)}`,
      );
    }

    const envelope = parseEnvelope(runResult.stdout);
    if (envelope.is_error) {
      throw new ProviderCallError(
        `[claude-code-provider] claude reported is_error: `
          + `${envelope.api_error_status ?? 'unknown'} (subtype=${envelope.subtype})`,
      );
    }

    const parsed = extractSchemaResult(envelope);
    const content: LlmContentBlock[] = [];
    if (parsed.thought && parsed.thought.length > 0) {
      content.push({ type: 'text', text: parsed.thought });
    }
    for (const tc of parsed.toolCalls) {
      if (typeof tc.name !== 'string') continue;
      if (typeof tc.input !== 'object' || tc.input === null) continue;
      content.push({
        type: 'tool_use',
        toolName: tc.name,
        toolInput: tc.input,
      });
    }

    const usage = envelope.usage ?? {};
    const tokensIn = (usage.input_tokens ?? 0)
      + (usage.cache_creation_input_tokens ?? 0)
      + (usage.cache_read_input_tokens ?? 0);
    const tokensOut = usage.output_tokens ?? 0;
    const costUsd = envelope.total_cost_usd ?? 0;

    return { content, tokensIn, tokensOut, costUsd };
  }
}

function buildClaudeCodeResponseSchema(tools: LlmToolSchema[]): Record<string, unknown> {
  // `name` is enum-constrained to the actual tools list — prevents the
  // model from inventing tool names the downstream validator would
  // reject (Codex impl-1 MED 4). With zero tools we'd produce an empty
  // enum which violates JSON-schema; in that edge case we fall back to
  // a free string so the call still goes through (the validator rejects
  // empty toolCalls anyway).
  const allowedNames = tools.map((t) => t.name);
  const nameSchema =
    allowedNames.length > 0
      ? { type: 'string', enum: allowedNames }
      : { type: 'string' };
  return {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description:
          'Short reasoning for this decision (1-3 sentences). Becomes the assistant text block.',
      },
      toolCalls: {
        type: 'array',
        description:
          'Each entry maps to one game command. `name` must match an action listed in the system prompt.',
        items: {
          type: 'object',
          properties: {
            name: nameSchema,
            input: { type: 'object' },
          },
          required: ['name', 'input'],
        },
      },
    },
    required: ['thought', 'toolCalls'],
  };
}

export function buildToolsPromptText(tools: LlmToolSchema[]): string {
  const lines = [
    '## Available Actions',
    '',
    'Each entry below is a callable action. To dispatch one, add an item to `toolCalls` with the listed `name` and an `input` object whose fields match the schema.',
    '',
  ];
  for (const t of tools) {
    lines.push(`### ${t.name}`);
    lines.push(t.description);
    lines.push('Input shape:');
    lines.push('```json');
    lines.push(JSON.stringify(t.inputSchema, null, 2));
    lines.push('```');
    lines.push('');
  }
  lines.push(
    'Respond with a single JSON object matching the schema:',
    '`{"thought": "<reasoning>", "toolCalls": [{"name": "<action>", "input": {...}}, ...]}`',
    'If no action is appropriate this tick, return `toolCalls: []` with a brief thought.',
  );
  return lines.join('\n');
}

function toCcInputBlock(block: LlmContentBlock): Record<string, unknown> {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'image') {
    return {
      type: 'image',
      source: { type: 'base64', media_type: block.mediaType, data: block.base64 },
    };
  }
  if (block.type === 'tool_use') {
    return { type: 'tool_use', name: block.toolName, input: block.toolInput };
  }
  const _exhaustive: never = block;
  return _exhaustive;
}

function parseEnvelope(stdout: string): ClaudeCodeOutputEnvelope {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new ProviderCallError('[claude-code-provider] empty stdout from claude');
  }
  // stream-json output is one JSON object per line. We want the line
  // where `type === "result"` — that carries the `result`, `usage`,
  // and `total_cost_usd` fields we need. Other lines (system init,
  // assistant deltas) are ignored.
  let resultEvent: ClaudeCodeOutputEnvelope | null = null;
  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (t.length === 0 || !t.startsWith('{')) continue;
    let evt: Record<string, unknown>;
    try {
      evt = JSON.parse(t) as Record<string, unknown>;
    } catch {
      // Skip malformed lines (e.g. trailing partial output). Don't
      // throw — the result event may still be present.
      continue;
    }
    if (evt.type === 'result') {
      // First result event wins — claude's stream emits exactly one
      // per call today; pinning to "first" documents the contract
      // (Claude impl-1 L3).
      resultEvent = evt as unknown as ClaudeCodeOutputEnvelope;
      break;
    }
  }
  if (!resultEvent) {
    throw new ProviderCallError(
      `[claude-code-provider] no result event found in stream-json output: ${truncate(trimmed, 300)}`,
    );
  }
  return resultEvent;
}

function extractSchemaResult(envelope: ClaudeCodeOutputEnvelope): ClaudeCodeResponseShape {
  // Prefer the pre-parsed `structured_output` field; fall back to
  // JSON-parsing `result` if the runtime didn't supply one (older
  // claude versions, or when --json-schema isn't honored).
  if (typeof envelope.structured_output === 'object' && envelope.structured_output !== null) {
    return normalizeSchemaShape(envelope.structured_output as Record<string, unknown>);
  }
  const resultStr = envelope.result;
  if (typeof resultStr !== 'string' || resultStr.trim().length === 0) {
    return { thought: '', toolCalls: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultStr);
  } catch (err) {
    throw new ProviderCallError(
      `[claude-code-provider] schema-constrained result was not JSON: `
        + `${(err as Error).message}\nresult: ${truncate(resultStr, 300)}`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ProviderCallError(
      `[claude-code-provider] schema-constrained result was not an object: `
        + truncate(resultStr, 300),
    );
  }
  return normalizeSchemaShape(parsed as Record<string, unknown>);
}

function normalizeSchemaShape(obj: Record<string, unknown>): ClaudeCodeResponseShape {
  const thought = typeof obj.thought === 'string' ? obj.thought : '';
  const rawCalls = Array.isArray(obj.toolCalls) ? obj.toolCalls : [];
  const toolCalls: ClaudeCodeResponseShape['toolCalls'] = [];
  for (const c of rawCalls) {
    if (typeof c !== 'object' || c === null) continue;
    const entry = c as Record<string, unknown>;
    if (typeof entry.name !== 'string') continue;
    if (typeof entry.input !== 'object' || entry.input === null) continue;
    toolCalls.push({ name: entry.name, input: entry.input as Record<string, unknown> });
  }
  return { thought, toolCalls };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…';
}

// Resolve `claude` to a directly-spawnable binary. On Windows, `claude`
// on PATH is typically a `.cmd` shim, but Node 22's CVE-2024-27980
// mitigation rejects `.cmd` files via `spawn` without shell:true; and
// shell:true on Windows wraps via cmd.exe which doesn't pipe stdin EOF
// reliably (claude hangs waiting for more input). We side-step both
// problems by spawning the .exe directly. We resolve via `where claude`
// (Windows) or `which claude` (POSIX) and prefer the .exe entry.
//
// Returns `null` on Windows when no `.exe` is found — e.g. when only
// the npm-global `.cmd` shim is on PATH. The runner uses this signal
// to refuse selecting the claude-code provider (Codex impl-1 MED 3).
export function resolveClaudeBinary(rawPath: string): string | null {
  if (process.platform !== 'win32') return rawPath;
  if (rawPath.endsWith('.exe')) return rawPath;
  const whereCmd = spawnSync('where', [rawPath], { encoding: 'utf8', shell: false });
  if (whereCmd.status !== 0) return null;
  const lines = whereCmd.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const exe = lines.find((l) => l.toLowerCase().endsWith('.exe'));
  return exe ?? null;
}

const defaultClaudeRun: ClaudeCodeRunFn = (cmd, args, stdinPayload, opts) =>
  new Promise((resolve, reject) => {
    const resolved = resolveClaudeBinary(cmd) ?? cmd;
    const proc = spawn(resolved, args as string[], {
      stdio: ['pipe', 'pipe', 'pipe'],
      // shell:false ensures stdin EOF reaches the child cleanly. We
      // resolved to .exe so Node 22's CVE-2024-27980 mitigation against
      // .cmd/.bat doesn't apply.
      shell: false,
      // cwd pinned to the per-call temp dir so claude doesn't pick up
      // the host repo's CLAUDE.md / AGENTS.md / SessionStart hooks
      // (Claude impl-1 H2).
      cwd: opts.cwd,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let escalateKill: ReturnType<typeof setTimeout> | undefined;
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    // Kill the child on timeout (Codex impl-1 HIGH 2). Without this,
    // the JS caller's promise rejects but the orphan claude process
    // keeps streaming bytes / paying API cost / blocking SIGINT cleanup.
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      // SIGTERM may not stop a stuck child on Windows; escalate.
      escalateKill = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Already exited — nothing to do.
        }
      }, TIMEOUT_KILL_ESCALATION_MS);
    }, opts.timeoutMs);
    proc.on('error', (err) => {
      clearTimeout(timer);
      if (escalateKill) clearTimeout(escalateKill);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (escalateKill) clearTimeout(escalateKill);
      if (timedOut) {
        reject(
          new Error(
            `[claude-code-provider] timed out after ${opts.timeoutMs}ms running '${cmd}' (pid killed)`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
    proc.stdin.write(stdinPayload, 'utf8');
    proc.stdin.end();
  });
