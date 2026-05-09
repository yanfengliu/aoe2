// Phase 3: orchestration loop for the LLM-agent playtest. Pure
// function shaped over a `RunnerHost` interface so unit tests can drive
// it without spawning Playwright. The Playwright wiring lives in
// `scripts/playtest-llm.mjs`, which constructs a `PlaywrightRunnerHost`
// adapter and feeds it in.

import type { SessionBundle } from 'civ-engine';
import type {
  AgentDecision,
  AgentDecisionCommand,
  AgentStateSnapshot,
  CommandDispatchResult,
  StopReason,
} from './types';
import type { LlmAgent } from './llmAgent';

export interface AgentDispatchEvent {
  commandType: string;
  accepted: boolean;
  rejectionReason?: string;
  rejectionMessage?: string;
}

export interface RunnerHost {
  /** Wait until the in-page game has booted (`__AOE2_TEST__.isBooted() === true`). */
  waitForBoot(): Promise<void>;
  /** Pull the bounded snapshot for the agent's owner. */
  snapshotForAgent(ownerId: number): Promise<AgentStateSnapshot>;
  /** Return canvas pixel bbox + capture a PNG (or undefined if disabled). */
  captureScreenshot(): Promise<Uint8Array | undefined>;
  /** Push one structured command onto pendingCommands; returns dispatch result. */
  dispatchCommand(cmd: AgentDecisionCommand): Promise<CommandDispatchResult>;
  /** Advance N world ticks. */
  advanceTicks(count: number): Promise<void>;
  /** Drain accumulated agent-dispatch events since the last call. */
  drainDispatchLog(): Promise<AgentDispatchEvent[]>;
  /** Export the recorder bundle as bytes (uses blob-URL path on Playwright). */
  exportBundle(): Promise<SessionBundle>;
  /** Current world tick (read-only). */
  getCurrentTick(): Promise<number>;
}

export interface LlmRunnerConfig {
  ownerId: number;
  maxTicks: number;
  decisionIntervalTicks: number; // ticks advanced per decision (default 250)
  screenshotEnabled: boolean;
  // Optional callback invoked once per decision (for trace streaming).
  onDecision?: (entry: TraceEntry) => void;
}

export interface TraceEntry {
  decisionIndex: number;
  tickBefore: number;
  tickAfter: number;
  decision: AgentDecision;
  dispatchResults: CommandDispatchResult[];
  dispatchEvents: AgentDispatchEvent[];
}

export interface RunnerEnvelope {
  stopReason: StopReason;
  ticksRun: number;
  decisionsRun: number;
  totalCostUsd: number;
  runStartedAt: string;
  runCompletedAt: string;
  errorMessage?: string;
}

export interface RunLlmPlaytestResult {
  bundle: SessionBundle;
  envelope: RunnerEnvelope;
  trace: TraceEntry[];
}

export async function runLlmPlaytest(input: {
  host: RunnerHost;
  agent: LlmAgent;
  config: LlmRunnerConfig;
}): Promise<RunLlmPlaytestResult> {
  const { host, agent, config } = input;
  const runStartedAt = new Date().toISOString();
  const trace: TraceEntry[] = [];
  let ticksRun = 0;
  let decisionsRun = 0;
  let stopReason: StopReason = 'maxTicks';
  let errorMessage: string | undefined;

  await host.waitForBoot();

  try {
    while (ticksRun < config.maxTicks) {
      const tickBefore = await host.getCurrentTick();
      const state = await host.snapshotForAgent(config.ownerId);
      const screenshot = config.screenshotEnabled ? await host.captureScreenshot() : undefined;
      const decision = await agent.decide(state, screenshot);

      const dispatchResults: CommandDispatchResult[] = [];
      if (decision.stopReason === 'normal') {
        for (const cmd of decision.commands) {
          const result = await host.dispatchCommand(cmd);
          dispatchResults.push(result);
        }
      }

      const ticksToAdvance = Math.min(
        config.decisionIntervalTicks,
        Math.max(1, config.maxTicks - ticksRun),
      );
      await host.advanceTicks(ticksToAdvance);
      ticksRun += ticksToAdvance;

      const dispatchEvents = await host.drainDispatchLog();
      const tickAfter = await host.getCurrentTick();

      const entry: TraceEntry = {
        decisionIndex: decisionsRun,
        tickBefore,
        tickAfter,
        decision,
        dispatchResults,
        dispatchEvents,
      };
      trace.push(entry);
      config.onDecision?.(entry);
      decisionsRun += 1;

      if (decision.stopReason === 'cost-budget-exceeded') {
        stopReason = 'stopWhen';
        errorMessage = 'cost-budget-exceeded';
        break;
      }
    }
  } catch (err) {
    stopReason = 'engineHalt';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // exportBundle can itself throw (e.g., page navigated away after the
  // engineHalt error already destabilized __AOE2_TEST__). Preserve the
  // envelope's diagnostic message in that case rather than letting the
  // export failure mask the original cause (Codex impl-345 M1).
  let bundle;
  try {
    bundle = await host.exportBundle();
  } catch (err) {
    if (stopReason !== 'engineHalt') {
      stopReason = 'engineHalt';
      errorMessage = err instanceof Error ? err.message : String(err);
    } else {
      const exportMsg = err instanceof Error ? err.message : String(err);
      errorMessage = `${errorMessage} (export-bundle also failed: ${exportMsg})`;
    }
    // Synthesize an empty bundle so the runner returns a usable shape
    // for the downstream trace writer. The envelope's stopReason +
    // errorMessage tell the operator what happened.
    bundle = makeEmptyBundleStub();
  }
  const runCompletedAt = new Date().toISOString();
  const envelope: RunnerEnvelope = {
    stopReason,
    ticksRun,
    decisionsRun,
    totalCostUsd: agent.cumulativeCostUsd,
    runStartedAt,
    runCompletedAt,
    errorMessage,
  };
  return { bundle, envelope, trace };
}

function makeEmptyBundleStub(): SessionBundle {
  return {
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
}
