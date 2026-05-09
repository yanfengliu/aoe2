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
import {
  extractWinner,
  type PerOwnerEntityCounts,
  type WinnerResult,
} from './winnerOracle';

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
  /** Phase-6.D: per-owner unit/building counts at the current tick.
   *  Used by the winner oracle to score the game outcome. */
  getEntityCountsByOwner(): Promise<PerOwnerEntityCounts>;
}

export interface LlmRunnerConfig {
  ownerId: number;
  maxTicks: number;
  decisionIntervalTicks: number; // ticks advanced per decision (default 250)
  screenshotEnabled: boolean;
  // Optional callback invoked once per decision (for trace streaming).
  onDecision?: (entry: TraceEntry) => void;
  // Phase-6.C.1: tick checkpoints at which to capture an extra
  // screenshot for visual-regression comparison. Each post-advance
  // step checks whether any checkpoint falls in the interval
  // (tickBefore, tickAfter] and captures one screenshot if so.
  // When undefined OR screenshotEnabled is false, no checkpoint
  // captures happen. The post-loop final screenshot is independent
  // of this list.
  baselineCheckpointTicks?: number[];
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
  // Phase-6.C.1 (Claude impl-1 HIGH): the corpus dashboard needs the
  // run's seed + maxTicks to render baseline thumbnail paths and the
  // run table. The runner itself doesn't know these (they come from
  // the runner script's CLI args), so the script stamps them onto
  // the envelope after `runLlmPlaytest` returns. Optional in the
  // type so unit tests that build envelopes manually don't have to
  // populate them.
  seed?: string;
  maxTicks?: number;
  // Phase-6.C.2: post-hoc observation-oracle verdict, when the runner
  // script wires it (env-gated; advisory only, does NOT affect CI
  // exit codes — engineHalt is still the regression signal).
  observation?: ObservationVerdict;
  // Phase-6.D: game-outcome scoring at the final tick. Populated
  // unconditionally (no opt-in flag) — scoring is cheap and useful
  // for any multi-owner playtest (AI-vs-LLM, future AI-vs-AI).
  winner?: WinnerResult;
  // Phase-6.C.1: visual-regression oracle result, when the runner
  // script wired it (script reads baseline PNGs from disk + the
  // checkpoint screenshots from RunLlmPlaytestResult and feeds them
  // to runVisualOracle). `deltas` is per-baseline-tick advisory
  // signal; `violations` are the high-severity diffs that should
  // gate corpus runs.
  visualOracle?: {
    deltas: import('./visualOracle').VisualDelta[];
    violations: import('./types').OracleViolation[];
    missingTicks: number[];
  };
}

export interface RunLlmPlaytestResult {
  bundle: SessionBundle;
  envelope: RunnerEnvelope;
  trace: TraceEntry[];
  // Phase-6.C.2: the last screenshot captured during the run loop,
  // surfaced for downstream observation-oracle calls. Undefined when
  // screenshotEnabled was false or no decisions ran.
  finalScreenshotPng?: Uint8Array;
  // Phase-6.C.1: per-checkpoint screenshots captured during the run.
  // The visual-regression oracle compares these against committed
  // baseline PNGs. Empty when no `baselineCheckpointTicks` were
  // configured or `screenshotEnabled` was false.
  checkpointScreenshots: Array<{ tick: number; pngBytes: Uint8Array }>;
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
  // Phase-6.C.1: checkpoint captures for the visual-regression oracle.
  const checkpointScreenshots: Array<{ tick: number; pngBytes: Uint8Array }> = [];
  // Sort baseline checkpoints ascending so the "crosses checkpoint"
  // detection is monotonic. Defensive copy so we don't mutate the
  // caller's array.
  const baselineCheckpoints = (config.baselineCheckpointTicks ?? [])
    .filter((t) => t > 0 && Number.isFinite(t))
    .slice()
    .sort((a, b) => a - b);
  let nextCheckpointIdx = 0;

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

      // Phase-6.C.1: capture screenshots ONLY when an advance lands
      // exactly on a baseline checkpoint tick. If the advance
      // overshoots a checkpoint (decisionInterval doesn't divide the
      // checkpoint), the checkpoint is SKIPPED (logged warn) — the
      // visual oracle then surfaces it as `missingTicks` rather than
      // matching against a wrong-tick screenshot which would
      // generate false diffs (Codex impl-1 MED 1).
      //
      // Operator guidance: align baselineCheckpointTicks to multiples
      // of decisionIntervalTicks. The capture-baselines script's
      // default checkpoints are 1000/2000/3000/4000/5000, which
      // divide cleanly by the default decisionIntervalTicks=250.
      if (config.screenshotEnabled && baselineCheckpoints.length > 0) {
        while (
          nextCheckpointIdx < baselineCheckpoints.length
          && baselineCheckpoints[nextCheckpointIdx]! <= tickAfter
        ) {
          const checkpointTick = baselineCheckpoints[nextCheckpointIdx]!;
          if (checkpointTick === tickAfter) {
            try {
              const png = await host.captureScreenshot();
              if (png) {
                checkpointScreenshots.push({ tick: checkpointTick, pngBytes: png });
              }
            } catch (err) {
              console.warn(
                `[runLlmPlaytest] checkpoint screenshot capture failed at tick ${checkpointTick}: `
                  + `${err instanceof Error ? err.message : String(err)}`,
              );
            }
          } else {
            // Misaligned: the advance overshot the checkpoint. Skip
            // the capture; the visual oracle will see it as a
            // missingTick which is honest signal.
            console.warn(
              `[runLlmPlaytest] checkpoint ${checkpointTick} skipped — advance landed at `
                + `${tickAfter} (decisionIntervalTicks=${config.decisionIntervalTicks} doesn't divide ${checkpointTick}).`,
            );
          }
          nextCheckpointIdx += 1;
        }
      }

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

  // Phase-6.D: post-loop game-outcome scoring. Only attempted on
  // clean exits — on engineHalt the page may be destabilized and
  // counts may be stale or unavailable. The winner field is left
  // undefined in that case (downstream tooling should treat
  // engineHalt as "not scored" rather than as a tie).
  //
  // Codex impl-1 MED 1a (winner contract): if the count probe throws
  // on a clean exit, escalate to engineHalt rather than silently
  // dropping the winner field — the contract is "winner present
  // unless engineHalt", so probe failure on a clean exit IS engineHalt
  // (parallels the post-loop screenshot escalation just above).
  let winner: WinnerResult | undefined;
  if (stopReason !== 'engineHalt') {
    try {
      const counts = await host.getEntityCountsByOwner();
      winner = extractWinner(counts);
    } catch (err) {
      stopReason = 'engineHalt';
      errorMessage = `winner-oracle count probe failed: ${err instanceof Error ? err.message : String(err)}`;
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
  // Codex impl-1 MED 1b: re-check stopReason at envelope-build time.
  // exportBundle may have flipped it to engineHalt AFTER the winner
  // probe ran successfully — in that case the winner field would
  // violate the "omitted on engineHalt" contract.
  const finalWinner = stopReason === 'engineHalt' ? undefined : winner;
  const runCompletedAt = new Date().toISOString();
  const envelope: RunnerEnvelope = {
    stopReason,
    ticksRun,
    decisionsRun,
    totalCostUsd: agent.cumulativeCostUsd,
    runStartedAt,
    runCompletedAt,
    errorMessage,
    ...(finalWinner !== undefined && { winner: finalWinner }),
  };
  return {
    bundle,
    envelope,
    trace,
    finalScreenshotPng: lastScreenshotPng,
    checkpointScreenshots,
  };
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
