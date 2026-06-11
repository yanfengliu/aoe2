// Unit tests for Phase-6.C.2 post-hoc observation oracle. Mocks the
// LLM provider so tests don't hit the real Claude Code CLI. The
// integration test path lives in claudeCodeProvider.integration.test.ts
// (gated by CC_INTEGRATION_TEST=1).

import { describe, it, expect } from 'vitest';
import {
  buildTraceSummary,
  SYSTEM_PROMPT_OBSERVATION,
  runObservationOracle,
} from '../../src/game/playtest/observationOracle';
import { MockProvider } from '../../src/game/playtest/llmProviders';
import type { LlmProvider } from '../../src/game/playtest/types';

describe('runObservationOracle', () => {
  it('returns verdict + notes from a valid set_observation tool call', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            { type: 'text', text: 'thinking out loud' },
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: {
                verdict: 'looked-fun',
                notes: 'Agent built a wall and pushed castle age in 4 minutes. Engaged!',
              },
            },
          ],
          tokensIn: 30000,
          tokensOut: 60,
        },
      ],
    });
    const result = await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: new Uint8Array([0xff, 0xd8, 0xff]),
      traceSummary: 'Ticks run: 5000\nDecisions: 20\nTotal cost: $1.20\nStop reason: maxTicks',
    });
    expect(result.verdict).toBe('looked-fun');
    expect(result.notes).toBe('Agent built a wall and pushed castle age in 4 minutes. Engaged!');
    expect(result.tokensIn).toBe(30000);
    expect(result.tokensOut).toBe(60);
  });

  it('falls back to inconclusive when the model emits no set_observation tool call', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [{ type: 'text', text: 'I observed the screenshot.' }],
          tokensIn: 100,
          tokensOut: 5,
        },
      ],
    });
    const result = await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: undefined,
      traceSummary: 'short',
    });
    expect(result.verdict).toBe('inconclusive');
    expect(result.notes).toMatch(/did not emit a valid set_observation/);
  });

  it('falls back to inconclusive on null/non-object toolInput (Codex impl-1 MED 2)', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            // Some providers could surface toolInput=null or a primitive
            // even though the schema declares it as object. Guard
            // against runtime drift; never throw.
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: null as unknown as Record<string, unknown>,
            },
          ],
          tokensIn: 5,
          tokensOut: 5,
        },
      ],
    });
    const result = await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: undefined,
      traceSummary: 'short',
    });
    expect(result.verdict).toBe('inconclusive');
    expect(result.notes).toMatch(/did not emit a valid set_observation/);
  });

  it('falls back to inconclusive on wrong toolName (skips non-set_observation tool_use)', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_strategy',
              toolInput: { strategy: 'rush' },
            },
          ],
          tokensIn: 5,
          tokensOut: 5,
        },
      ],
    });
    const result = await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: undefined,
      traceSummary: 'short',
    });
    expect(result.verdict).toBe('inconclusive');
    expect(result.notes).toMatch(/did not emit a valid set_observation/);
  });

  it('falls back to inconclusive on unknown verdict string', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: { verdict: 'meh', notes: 'mid' },
            },
          ],
          tokensIn: 10,
          tokensOut: 5,
        },
      ],
    });
    const result = await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: undefined,
      traceSummary: 'short',
    });
    expect(result.verdict).toBe('inconclusive');
  });

  it('forwards tokens + cost from the provider call', async () => {
    const provider = new MockProvider({
      responses: [
        {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: { verdict: 'looked-broken', notes: 'engineHalt at tick 1234' },
            },
          ],
          tokensIn: 20000,
          tokensOut: 25,
        },
      ],
      costTable: {
        'claude-sonnet-4-6': { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
      },
    });
    const result = await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: undefined,
      traceSummary: 'broken run',
    });
    expect(result.verdict).toBe('looked-broken');
    expect(result.tokensIn).toBe(20000);
    expect(result.tokensOut).toBe(25);
    // 20000 in × $3/Mtok = $0.06; 25 out × $15/Mtok ≈ $0.000375 → ~$0.0604
    expect(result.costUsd).toBeCloseTo(0.06038, 4);
  });

  it('passes the screenshot to the provider as a base64 image block', async () => {
    let capturedOptions: Parameters<LlmProvider['call']>[0] | null = null;
    const provider: LlmProvider = {
      async call(options) {
        capturedOptions = options;
        return {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: { verdict: 'inconclusive', notes: 'ack' },
            },
          ],
          tokensIn: 1,
          tokensOut: 1,
          costUsd: 0,
        };
      },
    };
    await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: new Uint8Array([1, 2, 3, 4]),
      traceSummary: 'summary',
    });
    expect(capturedOptions).not.toBeNull();
    const blocks = capturedOptions!.messages[0]!.content;
    expect(blocks[0]).toEqual({
      type: 'image',
      base64: Buffer.from(new Uint8Array([1, 2, 3, 4])).toString('base64'),
      mediaType: 'image/png',
    });
    expect(blocks[1]).toEqual({ type: 'text', text: 'summary' });
  });

  it('omits the image block when no screenshot is provided', async () => {
    let capturedOptions: Parameters<LlmProvider['call']>[0] | null = null;
    const provider: LlmProvider = {
      async call(options) {
        capturedOptions = options;
        return {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: { verdict: 'inconclusive', notes: 'no-image' },
            },
          ],
          tokensIn: 1,
          tokensOut: 1,
          costUsd: 0,
        };
      },
    };
    await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: undefined,
      traceSummary: 'text only',
    });
    const blocks = capturedOptions!.messages[0]!.content;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: 'text', text: 'text only' });
  });

  it('omits the image block when screenshot byteLength is 0', async () => {
    let capturedOptions: Parameters<LlmProvider['call']>[0] | null = null;
    const provider: LlmProvider = {
      async call(options) {
        capturedOptions = options;
        return {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: { verdict: 'inconclusive', notes: 'empty' },
            },
          ],
          tokensIn: 1,
          tokensOut: 1,
          costUsd: 0,
        };
      },
    };
    await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: new Uint8Array(0),
      traceSummary: 'no bytes',
    });
    expect(capturedOptions!.messages[0]!.content).toHaveLength(1);
  });

  it('respects custom maxOutputTokens', async () => {
    let capturedOptions: Parameters<LlmProvider['call']>[0] | null = null;
    const provider: LlmProvider = {
      async call(options) {
        capturedOptions = options;
        return {
          content: [
            {
              type: 'tool_use',
              toolName: 'set_observation',
              toolInput: { verdict: 'looked-fun', notes: 'ok' },
            },
          ],
          tokensIn: 1,
          tokensOut: 1,
          costUsd: 0,
        };
      },
    };
    await runObservationOracle({
      provider,
      model: 'claude-sonnet-4-6',
      finalScreenshotPng: undefined,
      traceSummary: 's',
      maxOutputTokens: 256,
    });
    expect(capturedOptions!.maxOutputTokens).toBe(256);
  });
});

describe('buildTraceSummary', () => {
  it('formats the standard envelope fields into a multi-line summary', () => {
    const text = buildTraceSummary({
      ticksRun: 5000,
      decisionsRun: 20,
      totalCostUsd: 1.234,
      stopReason: 'maxTicks',
    });
    expect(text).toContain('Ticks run: 5000');
    expect(text).toContain('Decisions made: 20');
    expect(text).toContain('Total cost: $1.2340');
    expect(text).toContain('Stop reason: maxTicks');
  });

  it('includes rejectionsCount when provided', () => {
    const text = buildTraceSummary({
      ticksRun: 1000,
      decisionsRun: 4,
      totalCostUsd: 0.4,
      stopReason: 'maxTicks',
      rejectionsCount: 3,
    });
    expect(text).toContain('Commands rejected by dispatcher: 3');
  });

  it('includes errorMessage when present', () => {
    const text = buildTraceSummary({
      ticksRun: 100,
      decisionsRun: 1,
      totalCostUsd: 0.01,
      stopReason: 'engineHalt',
      errorMessage: 'WorldTickFailureError: pathfind exception',
    });
    expect(text).toContain('Error: WorldTickFailureError');
  });
});

// playtest-fixes follow-up (finding G): the final screenshot's HUD
// shows the PASSIVE HUMAN player's resources, not the agent's — the
// 2026-06-10 clean run was graded "looked-broken: resources at exact
// starting values" while the agent's trace showed food 490 / pop 12/15.
// The summary must carry the agent's own final state and the system
// prompt must warn about the HUD ownership split.
describe('observation oracle — agent-owner grounding (finding G)', () => {
  it('buildTraceSummary renders the agent final state when provided', () => {
    const text = buildTraceSummary({
      ticksRun: 2000,
      decisionsRun: 8,
      totalCostUsd: 4.86,
      stopReason: 'maxTicks',
      rejectionsCount: 5,
      agentOwnerId: 2,
      finalAgentState: {
        ownerId: 2,
        age: 'dark-age',
        resources: { wood: 230, food: 490, gold: 100, stone: 200 },
        villagerCountByTask: { 'gathering-food': 6, idle: 1 },
        buildingCountByType: { 'town-center': 1, house: 2 },
        militaryCountByType: { scout: 2 },
        populationCurrent: 12,
        populationCap: 15,
      },
    });
    expect(text).toContain('Final agent state (owner 2)');
    expect(text).toContain('food: 490');
    expect(text).toContain('population: 12/15');
    expect(text).toContain('gathering-food: 6');
  });

  it('buildTraceSummary omits the agent-state block when not provided (back-compat)', () => {
    const text = buildTraceSummary({
      ticksRun: 100,
      decisionsRun: 1,
      totalCostUsd: 0.5,
      stopReason: 'maxTicks',
    });
    expect(text).not.toContain('Final agent state');
  });

  it('system prompt warns that the screenshot HUD shows the human observer, not the agent', () => {
    expect(SYSTEM_PROMPT_OBSERVATION).toContain('HUD');
    expect(SYSTEM_PROMPT_OBSERVATION).toContain('not the agent');
  });
});
