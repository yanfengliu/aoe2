// Shared fixtures for the llmRunner test files. Split out of the
// original single llmRunner.test.ts (which had grown past the 500-LOC
// budget) so llmRunner.test.ts (core loop) and
// llmRunner.oracles.test.ts (checkpoint/screenshot/winner) stay under
// the cap without duplicating the stub host.

import type { SessionBundle } from 'civ-engine';
import type { AgentDispatchEvent, RunnerHost } from '../../src/game/playtest/llmRunner';
import { LlmAgent } from '../../src/game/playtest/llmAgent';
import { MockProvider } from '../../src/game/playtest/llmProviders';
import type {
  AgentDecisionCommand,
  AgentStateSnapshot,
  CommandDispatchResult,
  LlmContentBlock,
} from '../../src/game/playtest/types';

export const STRATEGY_OK: LlmContentBlock[] = [
  {
    type: 'tool_use',
    toolName: 'set_strategy',
    toolInput: {
      strategy: 'Boom to feudal then add scouts.',
      targetAge: 'feudal-age',
      targetUnitMix: 'scouts, archers',
    },
  },
];

export const TACTICAL_OK_NO_COMMANDS: LlmContentBlock[] = [{ type: 'text', text: 'thinking' }];

export const TACTICAL_OK_ONE_COMMAND: LlmContentBlock[] = [
  { type: 'text', text: 'queueing a villager' },
  {
    type: 'tool_use',
    toolName: 'queue_train',
    toolInput: { buildingId: 7, unitType: 'villager' },
  },
];

export class StubHost implements RunnerHost {
  tickCounter = 0;
  dispatchedCommands: AgentDecisionCommand[] = [];
  advanceCalls: number[] = [];
  dispatchEvents: AgentDispatchEvent[][] = []; // one batch per drain call
  bundle: SessionBundle;
  bootResolved = false;
  failOn: keyof RunnerHost | null = null;
  // Ordered host-call log so tests can pin sequencing contracts
  // (e.g. playtest-fixes C: setPaused(true) before the first snapshot).
  callLog: string[] = [];
  // C2 (iter-4 review Finding C): simulate a match that completes
  // mid-run. When set, `getMatchOutcome` returns `matchEndOutcome` once
  // the tick reaches `matchEndsAtTick`, AND `advanceTicks` caps the tick
  // there — mirroring the live bridge, whose step() no-ops post-match so
  // the world tick freezes even as the host keeps calling advanceTicks.
  // Default null keeps the legacy free-advance / always-'running' host.
  matchEndsAtTick: number | null = null;
  matchEndOutcome = 'victory';

  constructor(bundle: SessionBundle) {
    this.bundle = bundle;
  }

  async waitForBoot(): Promise<void> {
    if (this.failOn === 'waitForBoot') throw new Error('boot failed');
    this.bootResolved = true;
    this.callLog.push('waitForBoot');
  }
  async getCurrentTick(): Promise<number> {
    return this.tickCounter;
  }
  async snapshotForAgent(ownerId: number): Promise<AgentStateSnapshot> {
    if (this.failOn === 'snapshotForAgent') throw new Error('snapshot failed');
    void ownerId;
    this.callLog.push('snapshot');
    return {
      tick: this.tickCounter,
      elapsedMmSs: '00:00',
      perPlayer: [],
      selection: [],
      ownUnits: [],
      ownBuildings: [],
      nearbyResources: [],
      enemies: [],
      queuedProduction: [],
      screenMapping: {
        worldBbox: { minX: 0, minY: 0, maxX: 16, maxY: 16 },
        pixelBbox: { x: 0, y: 0, width: 800, height: 600 },
        worldToScreen: [],
      },
    };
  }
  async captureScreenshot(): Promise<Uint8Array | undefined> {
    return new Uint8Array([1, 2, 3, 4]);
  }
  async dispatchCommand(cmd: AgentDecisionCommand): Promise<CommandDispatchResult> {
    if (this.failOn === 'dispatchCommand') throw new Error('dispatch failed');
    this.dispatchedCommands.push(cmd);
    return { accepted: true, commandKind: cmd.type, normalized: cmd.data };
  }
  async advanceTicks(count: number): Promise<void> {
    this.advanceCalls.push(count);
    this.callLog.push(`advance:${count}`);
    // C2: once the match ends the live bridge's step() no-ops, so a
    // requested batch may only PARTIALLY land (or not at all). Cap the
    // tick at matchEndsAtTick when configured; otherwise advance freely.
    this.tickCounter =
      this.matchEndsAtTick === null
        ? this.tickCounter + count
        : Math.min(this.tickCounter + count, this.matchEndsAtTick);
  }
  async drainDispatchLog(): Promise<AgentDispatchEvent[]> {
    return this.dispatchEvents.shift() ?? [];
  }
  async exportBundle(): Promise<SessionBundle> {
    return this.bundle;
  }
  // Phase-6.D: stub for the winner-oracle count probe. Default returns
  // empty (winner: tie). Tests that exercise winner extraction
  // override this on the instance.
  async getEntityCountsByOwner() {
    return {};
  }
  // C2 (iter-4 review Finding C): the live match outcome. Defaults to
  // 'running' (in-progress) so every existing test behaves like a live
  // match; flips to `matchEndOutcome` once the tick reaches
  // `matchEndsAtTick`, exactly as the live bridge reports a finished game.
  async getMatchOutcome(): Promise<string> {
    return this.matchEndsAtTick !== null && this.tickCounter >= this.matchEndsAtTick
      ? this.matchEndOutcome
      : 'running';
  }
}

// playtest-fixes C: host variant that supports the optional setPaused
// contract. The base StubHost intentionally lacks the method so the
// legacy free-running host path stays covered by every other test.
export class PausingStubHost extends StubHost {
  paused = false;
  async setPaused(paused: boolean): Promise<void> {
    this.paused = paused;
    this.callLog.push(`setPaused:${paused}`);
  }
}

export const MIN_BUNDLE = {
  schemaVersion: 1,
  metadata: {},
  initialSnapshot: {},
  ticks: [],
  commands: [],
  executions: [],
  failures: [],
  markers: [],
  attachments: [],
  snapshots: [],
} as unknown as SessionBundle;

export function makeAgent(provider: MockProvider) {
  return new LlmAgent({
    provider,
    ownerId: 2,
    strategyModel: 'claude-opus-4-7',
    tacticalModel: 'claude-sonnet-4-6',
    strategyEveryNDecisions: 100,
    maxOutputTokensTactical: 1024,
    maxOutputTokensStrategy: 2048,
    costBudgetUsd: 5.0,
    maxImageBytes: 1_048_576,
    historyWindow: 5,
  });
}
