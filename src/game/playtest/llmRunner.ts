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
  ObservationVerdict,
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
  // Phase-6.C.2: post-hoc observation-oracle verdict, when the runner
  // script wires it (env-gated; advisory only, does NOT affect CI
  // exit codes — engineHalt is still the regression signal).
  observation?: ObservationVerdict;
}

export interface RunLlmPlaytestResult {
  bundle: SessionBundle;
  envelope: RunnerEnvelope;
  trace: TraceEntry[];
  // Phase-6.C.2: the last screenshot captured during the run loop,
  // surfaced for downstream observation-oracle calls. Undefined when
  // screenshotEnabled was false or no decisions ran.
  finalScreenshotPng?: Uint8Array;
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
  // Phase-6.C.2: keep the most-recent screenshot so the post-hoc
  // observation oracle (run by the runner script) has the final-tick
  // visual context to inspect.
  let lastScreenshotPng: Uint8Array | undefined;

  await host.waitForBoot();

  try {
    while (ticksRun < config.maxTicks) {
      const tickBefore = await host.getCurrentTick();
      const state = await host.snapshotForAgent(config.ownerId);
      const screenshot = config.screenshotEnabled ? await host.captureScreenshot() : undefined;
      if (screenshot) lastScreenshotPng = screenshot;
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

  // Phase-6.C.2 (Codex impl-1 MED 1): capture an actual final-tick
  // screenshot AFTER the loop exits, not the pre-advance shot from
  // the last decision. The post-hoc observation oracle (advisory)
  // wants the truly-final visual state, including any engine-halt
  // failure surface.
  //
  // Codex impl-2 MED: the catch is narrow — only suppress when an
  // engineHalt already destabilized the page (in which case
  // captureScreenshot is expected to throw and the in-loop fallback
  // is the best we can do). On clean exits (maxTicks / stopWhen),
  // a screenshot failure indicates a real harness regression and
  // gets surfaced via stopReason='engineHalt' + errorMessage.
  if (config.screenshotEnabled) {
    if (stopReason === 'engineHalt') {
      try {
        const finalShot = await host.captureScreenshot();
        if (finalShot) lastScreenshotPng = finalShot;
      } catch {
        // Already-halted run; keep the in-loop fallback.
      }
    } else {
      try {
        const finalShot = await host.captureScreenshot();
        if (finalShot) lastScreenshotPng = finalShot;
      } catch (err) {
        // Clean exit but post-loop screenshot threw — surface as a
        // genuine harness failure rather than silently shipping the
        // stale in-loop screenshot to the oracle.
        stopReason = 'engineHalt';
        errorMessage = `final-screenshot capture failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
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
  return { bundle, envelope, trace, finalScreenshotPng: lastScreenshotPng };
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
