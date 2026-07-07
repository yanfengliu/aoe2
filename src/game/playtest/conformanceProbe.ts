// Conformance capture: turn a finished LLM playtest run into an
// OBJECTIVE backlog of ways the implementation is missing / broken /
// divergent from real Age of Empires II. Replaces the old "looked-fun"
// observation oracle (removed 2026-06-13 per user directive — fun is
// not a useful signal; players decide fun, the harness measures
// conformance).
//
// Two layers:
//   1. Hard metrics computed from the saved trace + envelope — no LLM,
//      fully deterministic (command-type usage, accept/reject by reason,
//      stalls, outcome). A command rejected `unknown-kind` literally
//      means "that action is not implemented".
//   2. An advisory LLM critique grounded in publicly-known AoE2 rules,
//      emitting structured findings. The model is told to be objective
//      and checkable, NOT to judge fun.
//
// Pure orchestration over an LlmProvider — no Playwright, no filesystem.
// The decoupled script (`scripts/playtest-findings.mjs`) does the I/O and
// can re-run this on ANY past or future run's artifacts for free.

import type {
  LlmContentBlock,
  LlmProvider,
  LlmToolSchema,
} from './types';
import type { WinnerResult } from './winnerOracle';

// The slim trace row shape written to `<prefix>.llm-trace.jsonl` by the
// runner script's onDecision hook.
export interface ConformanceTraceRow {
  decisionIndex: number;
  tickBefore: number;
  tickAfter: number;
  thought: string;
  commands: Array<{ type: string }>;
  costUsd: number;
  stopReason: string;
  dispatchEvents: Array<{
    commandType: string;
    accepted: boolean;
    rejectionReason?: string;
    rejectionMessage?: string;
  }>;
}

// The envelope fields the metrics need (subset of RunnerEnvelope).
export interface ConformanceEnvelopeLike {
  ticksRun: number;
  decisionsRun: number;
  totalCostUsd: number;
  stopReason: string;
  errorMessage?: string;
  winner?: WinnerResult;
  seed?: string;
  maxTicks?: number;
}

export interface RunMetricsCommandStat {
  attempted: number;
  accepted: number;
  rejected: number;
}

export interface RunMetrics {
  ticksRun: number;
  decisionsRun: number;
  totalCostUsd: number;
  stopReason: string;
  errorMessage?: string;
  maxTicks?: number;
  commandsAttempted: number;
  commandsAccepted: number;
  commandsRejected: number;
  commandTypeStats: Record<string, RunMetricsCommandStat>;
  rejectionReasonCounts: Record<string, number>;
  distinctCommandTypes: string[];
  stallDecisions: number;
  winner?: WinnerResult;
}

export const FINDING_CATEGORIES = [
  'missing-feature',
  'spec-divergence',
  'functional-bug',
  'balance-divergence',
  'ux-gap',
] as const;
export const FINDING_SEVERITIES = ['low', 'medium', 'high'] as const;

export interface ConformanceFinding {
  category: (typeof FINDING_CATEGORIES)[number];
  area: string;
  observed: string;
  expected: string;
  severity: (typeof FINDING_SEVERITIES)[number];
  suggestion: string;
}

export interface ConformanceResult {
  findings: ConformanceFinding[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  // Set when the model produced no valid record_findings tool call.
  note?: string;
}

export const SYSTEM_PROMPT_CONFORMANCE = `You are an Age of Empires II conformance auditor. You know precisely how real Age of Empires II (Definitive Edition / HD) works: its four ages, four-resource economy, full unit/building/technology rosters, combat armor classes and bonus damage, civilization bonuses, and standard Random Map flow.

You are given an OBJECTIVE digest of one automated playtest of an AoE2 clone: hard metrics (what commands a competent LLM player issued, what was accepted or rejected and why, where it stalled, the outcome) plus the player's own per-decision notes, and possibly a final screenshot.

Your job: identify concrete, checkable ways the implementation is MISSING, BROKEN, or DIVERGENT from real AoE2. For each, record a finding via the record_findings tool with:
- category: missing-feature (a real-AoE2 capability the game lacks), spec-divergence (present but behaves differently from real AoE2), functional-bug (something that should work but failed/was rejected), balance-divergence (costs/stats/timings off vs real AoE2), or ux-gap (the player lacked information/affordance it needs).
- area: the subsystem (e.g. castle-age, market, monk, archer-line, farm, wall, combat, population).
- observed: what the run actually showed — cite the metric/rejection/thought it is grounded in.
- expected: how real AoE2 behaves, specifically (numbers when you know them).
- severity: high (blocks a normal game progressing toward a full Castle/Imperial match), medium, or low.
- suggestion: a concrete implementation action.

Rules:
- Always call record_findings exactly once; if there are no findings, call it with findings: [] instead of replying only in prose.
- Do not infer a feature is missing just because a short or early-game run did not use it. In Age of Empires II, age-up, technology, and combat often do not appear in the first few minutes of a normal opening. Treat absence as evidence only when the digest shows an attempted command rejected as unknown/unavailable, the player's notes explicitly say no affordance exists, or the run lasted long enough to reach the normal prerequisites and timing.
- The command-type tally is usage evidence from this run, not a complete list of every command the game implements.
- Be OBJECTIVE and grounded. Every finding must be checkable against how real AoE2 works or against the digest. Do NOT judge whether the game "looks fun" — that is not your job.
- Favour findings that explain why the run could not progress into a full AoE2 match (missing ages, untrainable units, dead techs, absent mechanics).
- Prefer fewer, higher-quality, distinct findings over many overlapping ones. If the game is fully conformant in some area, do not invent a finding for it.`;

// ---- Layer 1: deterministic metrics ----------------------------------

export function computeRunMetrics(
  envelope: ConformanceEnvelopeLike,
  rows: ConformanceTraceRow[],
): RunMetrics {
  const commandTypeStats: Record<string, RunMetricsCommandStat> = {};
  const rejectionReasonCounts: Record<string, number> = {};
  let commandsAttempted = 0;
  let commandsAccepted = 0;
  let commandsRejected = 0;
  let stallDecisions = 0;

  const stat = (type: string): RunMetricsCommandStat =>
    (commandTypeStats[type] ??= { attempted: 0, accepted: 0, rejected: 0 });

  for (const row of rows) {
    const cmds = row.commands ?? [];
    // A stall = a NORMAL decision that issued no commands. A
    // cost-budget-exceeded decision also has zero commands but is an
    // operator cost gate, not a gameplay stall (Codex conformance iter-1).
    if (cmds.length === 0 && row.stopReason !== 'cost-budget-exceeded') {
      stallDecisions += 1;
    }
    for (const c of cmds) {
      commandsAttempted += 1;
      stat(c.type).attempted += 1;
    }
    for (const ev of row.dispatchEvents ?? []) {
      const s = stat(ev.commandType);
      if (ev.accepted) {
        commandsAccepted += 1;
        s.accepted += 1;
      } else {
        commandsRejected += 1;
        s.rejected += 1;
        const reason = ev.rejectionReason ?? 'unspecified';
        rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1;
      }
    }
  }

  const distinctCommandTypes = Object.keys(commandTypeStats)
    .filter((t) => commandTypeStats[t]!.attempted > 0)
    .sort();

  return {
    ticksRun: envelope.ticksRun,
    decisionsRun: envelope.decisionsRun,
    totalCostUsd: envelope.totalCostUsd,
    stopReason: envelope.stopReason,
    errorMessage: envelope.errorMessage,
    maxTicks: envelope.maxTicks,
    commandsAttempted,
    commandsAccepted,
    commandsRejected,
    commandTypeStats,
    rejectionReasonCounts,
    distinctCommandTypes,
    stallDecisions,
    winner: envelope.winner,
  };
}

function winnerLabel(w?: WinnerResult): string {
  if (!w) return 'not scored';
  if (w.kind === 'winner') return `winner: owner ${w.ownerId}`;
  if (w.kind === 'tie') return 'tie (no survivors)';
  return `in-progress (alive owners ${w.aliveOwners.join(', ')}) — no decisive result`;
}

// ---- Layer 1.5: LLM-facing digest ------------------------------------

function isShortOpeningSample(metrics: RunMetrics): boolean {
  return metrics.stopReason === 'maxTicks'
    && metrics.maxTicks !== undefined
    && metrics.ticksRun >= metrics.maxTicks
    && metrics.ticksRun <= 1500;
}

export function buildConformanceDigest(
  metrics: RunMetrics,
  rows: ConformanceTraceRow[],
): string {
  const lines: string[] = [];
  lines.push('## Run metrics (objective, computed from the trace)');
  const maxTicksPart = metrics.maxTicks === undefined ? '' : `; maxTicks ${metrics.maxTicks}`;
  lines.push(
    `- ticks ${metrics.ticksRun} · decisions ${metrics.decisionsRun} · cost $${metrics.totalCostUsd.toFixed(2)} · stopReason ${metrics.stopReason}`,
  );
  if (metrics.errorMessage) lines.push(`- errorMessage: ${metrics.errorMessage}`);
  if (maxTicksPart) lines.push(`- run limit${maxTicksPart}`);
  lines.push(`- outcome: ${winnerLabel(metrics.winner)}`);
  lines.push(
    `- commands: ${metrics.commandsAttempted} attempted, ${metrics.commandsAccepted} accepted, ${metrics.commandsRejected} rejected`,
  );
  lines.push(`- stall decisions (issued no commands): ${metrics.stallDecisions}`);
  lines.push(
    `- distinct command types used in this run: ${metrics.distinctCommandTypes.join(', ') || '(none)'}`,
  );
  const rej = Object.entries(metrics.rejectionReasonCounts);
  lines.push(
    `- rejection reasons: ${rej.length ? rej.map(([r, n]) => `${r}×${n}`).join(', ') : '(none)'}`,
  );
  if (isShortOpeningSample(metrics)) {
    lines.push(
      '- evidence caution: this was a short opening sample that stopped at maxTicks; absence of age-up, research, or combat commands is not by itself evidence that age progression, technology, or combat are missing. Prefer no finding unless the trace shows an unknown/unavailable rejection, an explicit player note that the affordance does not exist, or a run long enough to reach normal AoE2 prerequisites.',
    );
  }
  lines.push('');
  lines.push('## Per-command-type tally');
  for (const t of metrics.distinctCommandTypes) {
    const s = metrics.commandTypeStats[t]!;
    lines.push(`- ${t}: ${s.attempted} attempted / ${s.accepted} accepted / ${s.rejected} rejected`);
  }
  lines.push('');
  lines.push("## Decision timeline (player's own notes + command outcomes)");
  for (const row of rows) {
    const types = (row.commands ?? []).map((c) => c.type);
    const rejected = (row.dispatchEvents ?? [])
      .filter((e) => !e.accepted)
      .map((e) => `${e.commandType}:${e.rejectionReason ?? 'rejected'}`);
    const thought = (row.thought ?? '').replace(/\s+/g, ' ').trim().slice(0, 280);
    const cmdPart = types.length ? types.join(', ') : '(no commands — stall)';
    const rejPart = rejected.length ? ` | REJECTED: ${rejected.join('; ')}` : '';
    lines.push(`#${row.decisionIndex} @tick ${row.tickAfter}: ${thought}`);
    lines.push(`    cmds: ${cmdPart}${rejPart}`);
  }
  return lines.join('\n');
}

// ---- Layer 2: advisory LLM critique ----------------------------------

export interface RunConformanceProbeInput {
  provider: LlmProvider;
  model: string;
  digest: string;
  finalScreenshotPng?: Uint8Array;
  maxOutputTokens?: number;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

export async function runConformanceProbe(
  input: RunConformanceProbeInput,
): Promise<ConformanceResult> {
  const tool: LlmToolSchema = {
    name: 'record_findings',
    description:
      'Record objective conformance/completeness findings comparing this AoE2 clone run to real Age of Empires II.',
    inputSchema: {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: [...FINDING_CATEGORIES] },
              area: { type: 'string' },
              observed: { type: 'string' },
              expected: { type: 'string' },
              severity: { type: 'string', enum: [...FINDING_SEVERITIES] },
              suggestion: { type: 'string' },
            },
            required: ['category', 'area', 'observed', 'expected', 'severity', 'suggestion'],
          },
        },
      },
      required: ['findings'],
    },
  };

  const content: LlmContentBlock[] = [];
  if (input.finalScreenshotPng && input.finalScreenshotPng.byteLength > 0) {
    content.push({
      type: 'image',
      base64: Buffer.from(input.finalScreenshotPng).toString('base64'),
      mediaType: 'image/png',
    });
  }
  content.push({ type: 'text', text: input.digest });

  const result = await input.provider.call({
    model: input.model,
    systemPrompt: SYSTEM_PROMPT_CONFORMANCE,
    messages: [{ role: 'user', content }],
    tools: [tool],
    maxOutputTokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  });

  const parsed = parseFindings(result.content);
  return {
    findings: parsed.findings,
    note: parsed.note,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  };
}

function parseFindings(
  content: LlmContentBlock[],
): { findings: ConformanceFinding[]; note?: string } {
  for (const block of content) {
    if (block.type !== 'tool_use' || block.toolName !== 'record_findings') continue;
    if (typeof block.toolInput !== 'object' || block.toolInput === null) continue;
    const raw = (block.toolInput as Record<string, unknown>).findings;
    if (!Array.isArray(raw)) continue;
    const findings: ConformanceFinding[] = [];
    for (const f of raw) {
      if (typeof f !== 'object' || f === null) continue;
      const o = f as Record<string, unknown>;
      const category = String(o.category);
      const severity = String(o.severity);
      if (!(FINDING_CATEGORIES as readonly string[]).includes(category)) continue;
      if (!(FINDING_SEVERITIES as readonly string[]).includes(severity)) continue;
      findings.push({
        category: category as ConformanceFinding['category'],
        area: typeof o.area === 'string' ? o.area : '',
        observed: typeof o.observed === 'string' ? o.observed : '',
        expected: typeof o.expected === 'string' ? o.expected : '',
        severity: severity as ConformanceFinding['severity'],
        suggestion: typeof o.suggestion === 'string' ? o.suggestion : '',
      });
    }
    // A non-empty findings array that yielded zero valid items means the
    // model emitted malformed findings (bad category/severity). Surface
    // that to the operator instead of a silent clean "no findings"
    // report (Codex conformance iter-1).
    if (findings.length === 0 && raw.length > 0) {
      return {
        findings,
        note: 'record_findings returned only invalid findings (bad category/severity)',
      };
    }
    return { findings };
  }
  return {
    findings: [],
    note: 'model did not emit a valid record_findings tool call',
  };
}

// ---- Report formatting -----------------------------------------------

export function formatFindingsMarkdown(
  metrics: RunMetrics,
  findings: ConformanceFinding[],
  meta: { prefix: string; model?: string; note?: string },
): string {
  const order: Record<ConformanceFinding['severity'], number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  const lines: string[] = [];
  lines.push(`# Conformance findings — ${meta.prefix}`);
  lines.push('');
  lines.push(`Source: ${meta.model ?? '(metrics-only, no LLM critique)'} · ${findings.length} findings`);
  // Persist the probe note INTO the artifact (Codex conformance iter-2):
  // a malformed/all-invalid model turn must not read as a clean
  // no-findings report — a stderr-only warning is easy to miss.
  if (meta.note) {
    lines.push('');
    lines.push(`> ⚠ probe note: ${meta.note}`);
  }
  lines.push('');
  lines.push('## Objective metrics');
  lines.push(
    `- ticks ${metrics.ticksRun} · decisions ${metrics.decisionsRun} · cost $${metrics.totalCostUsd.toFixed(2)} · stopReason ${metrics.stopReason}`,
  );
  if (metrics.errorMessage) lines.push(`- errorMessage: ${metrics.errorMessage}`);
  lines.push(`- outcome: ${winnerLabel(metrics.winner)}`);
  lines.push(
    `- commands: ${metrics.commandsAttempted} attempted / ${metrics.commandsAccepted} accepted / ${metrics.commandsRejected} rejected · stalls ${metrics.stallDecisions}`,
  );
  lines.push(
    `- command types used (${metrics.distinctCommandTypes.length}): ${metrics.distinctCommandTypes.join(', ') || '(none)'}`,
  );
  const rej = Object.entries(metrics.rejectionReasonCounts);
  if (rej.length) lines.push(`- rejections: ${rej.map(([r, n]) => `${r}×${n}`).join(', ')}`);
  lines.push('');
  lines.push('## Findings (highest severity first)');
  lines.push('');
  if (!sorted.length) {
    lines.push('_No findings recorded._');
  } else {
    for (const f of sorted) {
      lines.push(`### [${f.severity}] ${f.category} — ${f.area}`);
      lines.push(`- observed: ${f.observed}`);
      lines.push(`- expected (real AoE2): ${f.expected}`);
      lines.push(`- suggestion: ${f.suggestion}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
