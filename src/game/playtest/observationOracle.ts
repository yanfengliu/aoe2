// Phase-6.C.2: post-hoc observation oracle. After a playtest run
// completes, a single advisory LLM call examines the final-tick
// screenshot + a textual trace summary and emits a verdict (looked
// fun, looked broken, inconclusive) + free-form notes. The verdict
// does NOT gate CI (the existing engineHalt vs maxTicks distinction
// remains the regression signal); this layer's purpose is qualitative
// feedback the operator can scan without watching the full replay.
//
// Pure orchestration over an LlmProvider — no Playwright, no I/O. The
// caller (`scripts/playtest-llm.mjs`) is responsible for skipping the
// oracle when `envelope.errorMessage === 'cost-budget-exceeded'` — the
// agent's rolling-cost gate already tripped, no point paying for an
// advisory after the operator's cap.

import type {
  AgentPlayerState,
  LlmCallOptions,
  LlmContentBlock,
  LlmProvider,
  LlmToolSchema,
  ObservationVerdict,
} from './types';

export const SYSTEM_PROMPT_OBSERVATION = `You are a post-game observer for an AoE2 playtest. Your job:
- Look at the final-tick screenshot of the game.
- Read the textual run summary (decisions made, ticks elapsed, total cost, stop reason, any error).
- IMPORTANT: the resource/population HUD in the screenshot belongs to the passive HUMAN observer player, not the agent. Judge the agent's economic progress from the "Final agent state" block in the summary, and use the screenshot only for map/visual context (exploration, buildings, unit positions).
- Decide whether the run "looked fun" (interesting interactions, the agent made progress), "looked broken" (the agent got stuck, the engine halted, units stalled), or "inconclusive" (not enough signal to say).
- Write a short notes paragraph (1-3 sentences) explaining what you saw.
You will not emit any commands; only the verdict + notes via the \`set_observation\` tool.`;

export interface RunObservationOracleInput {
  provider: LlmProvider;
  model: string;
  finalScreenshotPng?: Uint8Array;
  traceSummary: string;
  maxOutputTokens?: number;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 512;

export async function runObservationOracle(
  input: RunObservationOracleInput,
): Promise<ObservationVerdict> {
  const tool: LlmToolSchema = {
    name: 'set_observation',
    description: 'Record the post-game verdict.',
    inputSchema: {
      type: 'object',
      properties: {
        verdict: {
          type: 'string',
          enum: ['looked-fun', 'looked-broken', 'inconclusive'],
        },
        notes: { type: 'string' },
      },
      required: ['verdict', 'notes'],
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
  content.push({ type: 'text', text: input.traceSummary });
  const callOptions: LlmCallOptions = {
    model: input.model,
    systemPrompt: SYSTEM_PROMPT_OBSERVATION,
    messages: [{ role: 'user', content }],
    tools: [tool],
    maxOutputTokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
  };
  const result = await input.provider.call(callOptions);
  const verdict = parseObservationResponse(result.content);
  return {
    verdict: verdict.verdict,
    notes: verdict.notes,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
  };
}

function parseObservationResponse(
  content: LlmContentBlock[],
): { verdict: ObservationVerdict['verdict']; notes: string } {
  for (const block of content) {
    if (block.type !== 'tool_use') continue;
    if (block.toolName !== 'set_observation') continue;
    // Codex impl-1 MED 2: defensive toolInput shape check. A provider
    // could surface `null` or a primitive here even though the schema
    // declares it as `object`; guard against runtime drift.
    if (typeof block.toolInput !== 'object' || block.toolInput === null) continue;
    const input = block.toolInput as Record<string, unknown>;
    const verdict = String(input.verdict);
    const notes = typeof input.notes === 'string' ? input.notes : '';
    if (
      verdict === 'looked-fun'
      || verdict === 'looked-broken'
      || verdict === 'inconclusive'
    ) {
      return { verdict, notes };
    }
  }
  // Fallback: model didn't emit a valid set_observation call. The
  // observation is advisory anyway, so treat as inconclusive rather
  // than throwing — keeps the playtest's primary regression signal
  // (engineHalt) untainted by oracle parsing failures.
  return {
    verdict: 'inconclusive',
    notes: '[observation-oracle] model did not emit a valid set_observation tool call',
  };
}

// Convenience: build the standard run-summary text from the envelope
// fields the runner already populates. The runner script wires this
// (envelope → summary string) so callers don't have to repeat
// formatting code.
export function buildTraceSummary(input: {
  ticksRun: number;
  decisionsRun: number;
  totalCostUsd: number;
  stopReason: string;
  errorMessage?: string;
  rejectionsCount?: number;
  // Finding G (2026-06-10): the screenshot HUD shows the passive human
  // observer's resources, so without the AGENT's own final state the
  // oracle grades the wrong player — a competent run was judged
  // "looked-broken: resources at exact starting values". When provided,
  // the agent's economy is rendered into the summary so verdicts are
  // grounded on the right owner.
  agentOwnerId?: number;
  finalAgentState?: AgentPlayerState;
}): string {
  const lines = [
    `Ticks run: ${input.ticksRun}`,
    `Decisions made: ${input.decisionsRun}`,
    `Total cost: $${input.totalCostUsd.toFixed(4)}`,
    `Stop reason: ${input.stopReason}`,
  ];
  if (typeof input.rejectionsCount === 'number') {
    lines.push(`Commands rejected by dispatcher: ${input.rejectionsCount}`);
  }
  if (input.errorMessage) {
    lines.push(`Error: ${input.errorMessage}`);
  }
  if (input.finalAgentState) {
    const s = input.finalAgentState;
    const owner = input.agentOwnerId ?? s.ownerId;
    lines.push(
      `Final agent state (owner ${owner}):`,
      `  age: ${s.age}`,
      `  resources — wood: ${s.resources.wood}, food: ${s.resources.food}, gold: ${s.resources.gold}, stone: ${s.resources.stone}`,
      `  population: ${s.populationCurrent}/${s.populationCap}`,
      `  villagers by task: ${Object.entries(s.villagerCountByTask).map(([k, v]) => `${k}: ${v}`).join(', ') || '(none)'}`,
      `  buildings: ${Object.entries(s.buildingCountByType).map(([k, v]) => `${k}: ${v}`).join(', ') || '(none)'}`,
      `  military: ${Object.entries(s.militaryCountByType).map(([k, v]) => `${k}: ${v}`).join(', ') || '(none)'}`,
    );
  }
  return lines.join('\n');
}
