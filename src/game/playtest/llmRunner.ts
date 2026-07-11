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
import { ProviderCallError } from './llmProviders/providerError';
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
  /** playtest-fixes C (optional): pause/resume the live simulation.
   *  When present, the runner pauses once after boot so the game does
   *  NOT self-tick in real time while the agent thinks (~60-100s per
   *  claude-code call drifted the bridge to tick 5413 on a maxTicks
   *  2000 run, 2026-06-09). Pausing hosts must make `advanceTicks`
   *  atomic (unpause → step N → repause in one synchronous page task)
   *  so `advanceTicks` is the ONLY tick source and checkpoints land
   *  exactly. Hosts without it keep the legacy free-running behavior. */
  setPaused?(paused: boolean): Promise<void>;
  /** Drain accumulated agent-dispatch events since the last call. */
  drainDispatchLog(): Promise<AgentDispatchEvent[]>;
  /** Export the recorder bundle (Playwright host: chunked page.evaluate pull). */
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
  // Checkpoint ticks at which to capture an extra screenshot for the
  // corpus dashboard (option C, 2026-06-10: no baseline comparison —
  // LLM runs are non-deterministic, so there is no "correct" reference
  // image; render regressions are covered by the deterministic
  // Playwright/browser suites). A capture fires only when an advance
  // lands EXACTLY on a checkpoint, so align these to multiples of
  // decisionIntervalTicks. When undefined OR screenshotEnabled is
  // false, no checkpoint captures happen. The post-loop final
  // screenshot is independent of this list.
  screenshotCheckpointTicks?: number[];
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
  // The corpus dashboard needs the run's seed + maxTicks for the
  // run table. The runner itself doesn't know these (they come from
  // the runner script's CLI args), so the script stamps them onto
  // the envelope after `runLlmPlaytest` returns. Optional in the
  // type so unit tests that build envelopes manually don't have to
  // populate them.
  seed?: string;
  maxTicks?: number;
  // Phase-6.D: game-outcome scoring at the final tick. Populated
  // unconditionally (no opt-in flag) — scoring is cheap and useful
  // for any multi-owner playtest (AI-vs-LLM, future AI-vs-AI).
  winner?: WinnerResult;
}

export interface RunLlmPlaytestResult {
  bundle: SessionBundle;
  envelope: RunnerEnvelope;
  trace: TraceEntry[];
  // The last screenshot captured during the run loop, surfaced for the
  // decoupled post-hoc conformance probe. Undefined when
  // screenshotEnabled was false or no decisions ran.
  finalScreenshotPng?: Uint8Array;
  // Per-checkpoint screenshots captured during the run, persisted by
  // the script for the corpus dashboard. Empty when no
  // `screenshotCheckpointTicks` were configured or `screenshotEnabled`
  // was false.
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
  // Keep the most-recent screenshot so the decoupled post-hoc
  // conformance probe has the final-tick visual context to inspect.
  let lastScreenshotPng: Uint8Array | undefined;
  // Checkpoint captures for the corpus dashboard.
  const checkpointScreenshots: Array<{ tick: number; pngBytes: Uint8Array }> = [];
  // Sort screenshot checkpoints ascending so the "crosses checkpoint"
  // detection is monotonic. Defensive copy so we don't mutate the
  // caller's array.
  const screenshotCheckpoints = (config.screenshotCheckpointTicks ?? [])
    .filter((t) => t > 0 && Number.isFinite(t))
    .slice()
    .sort((a, b) => a - b);
  let nextCheckpointIdx = 0;

  await host.waitForBoot();
  // playtest-fixes C: freeze the sim before the first decision. The
  // host's advanceTicks then becomes the sole tick source — tickAfter
  // tracks ticksRun exactly, maxTicks regains exact semantics, and
  // screenshot checkpoints (multiples of decisionIntervalTicks) align.
  if (host.setPaused) await host.setPaused(true);

  try {
    while (ticksRun < config.maxTicks) {
      const tickBefore = await host.getCurrentTick();
      const state = await host.snapshotForAgent(config.ownerId);
      const screenshot = config.screenshotEnabled ? await host.captureScreenshot() : undefined;
      if (screenshot) lastScreenshotPng = screenshot;

      // provider-error-retry: agent.decide() makes the LLM calls through a
      // RetryingProvider, which retries a transient ProviderCallError in
      // place with backoff. If it still throws here, retries were exhausted
      // → classify the run as `providerError` and break. Because that is
      // NOT engineHalt, the game/page is treated as healthy: post-loop
      // scoring, the final screenshot, and bundle export still run (each
      // with its own safety net that flips to engineHalt if the page turns
      // out to be unusable). Any OTHER throw (host calls, a non-provider
      // agent bug) propagates to the outer catch → engineHalt.
      let decision: AgentDecision;
      try {
        decision = await agent.decide(state, screenshot);
      } catch (err) {
        if (err instanceof ProviderCallError) {
          stopReason = 'providerError';
          errorMessage = `provider call failed (retries exhausted): ${err.message}`;
          break;
        }
        throw err;
      }

      const dispatchResults: CommandDispatchResult[] = [];
      // playtest-fixes iter-2 (Codex MED 1): host-level rejections
      // (not-owned / malformed-payload / unknown-kind) never enter the
      // engine queue, so they would be invisible to the drained events
      // below — and an all-rejected decision would read as "0 accepted,
      // 0 rejected" in the next prompt. Synthesize feedback events for
      // them here and merge before reporting.
      const preQueueRejections: AgentDispatchEvent[] = [];
      if (decision.stopReason === 'normal') {
        for (const cmd of decision.commands) {
          const result = await host.dispatchCommand(cmd);
          dispatchResults.push(result);
          if (!result.accepted) {
            preQueueRejections.push({
              commandType: cmd.type,
              accepted: false,
              rejectionReason: result.reason,
              rejectionMessage: result.details,
            });
          }
        }
      }

      const ticksToAdvance = Math.min(
        config.decisionIntervalTicks,
        Math.max(1, config.maxTicks - ticksRun),
      );
      await host.advanceTicks(ticksToAdvance);
      // M13-#2: detect a silent halt — a frozen page whose advanceTicks is a
      // no-op (not a throw) would otherwise let ticksRun climb to maxTicks,
      // false-greening the run (winner oracle scores stale counts, corpus
      // regression sees a clean maxTicks). If the sim did not advance AT ALL,
      // stop honestly. Use `<= tickBefore` (no progress), NOT a strict
      // requested-amount check — free-running hosts legitimately overshoot.
      if ((await host.getCurrentTick()) <= tickBefore) {
        stopReason = 'engineHalt';
        errorMessage = `sim did not advance at tick ${tickBefore} (requested ${ticksToAdvance})`;
        break;
      }
      ticksRun += ticksToAdvance;

      const dispatchEvents = await host.drainDispatchLog();
      // Merge host-level pre-queue rejections (not-owned / malformed-
      // payload / unknown-kind) — which never reach the engine drain —
      // with the drained engine events. BOTH the agent's next prompt AND
      // the trace entry use this merged list, so the conformance metrics
      // and digest see host rejections too. `unknown-kind` in particular
      // is the primary objective signal that a command/feature is
      // unimplemented; dropping it from the trace hid the capture's most
      // important signal (Gemini conformance-capture iter-1).
      const allDispatchEvents = [...preQueueRejections, ...dispatchEvents];
      // playtest-fixes B: report the engine's verdicts onto the
      // just-made decision so the NEXT tactical prompt shows the model
      // what its commands actually did (rejections were previously
      // trace-only and the agent retried identical wrong ids blind).
      // Guard on a normal decision: a cost-budget-exceeded decide()
      // returns early WITHOUT pushing a history entry, so reporting
      // would clobber the PREVIOUS decision's outcome with this
      // round's (empty) drain.
      if (decision.stopReason === 'normal') {
        agent.reportDispatchOutcome(allDispatchEvents);
      }
      const tickAfter = await host.getCurrentTick();

      // Capture screenshots ONLY when an advance lands exactly on a
      // checkpoint tick (dashboard thumbnails; no baseline diffing). If
      // the advance overshoots a checkpoint (decisionInterval doesn't
      // divide it), the checkpoint is SKIPPED with a warn — better no
      // thumbnail than a wrong-tick one.
      //
      // Operator guidance: align screenshotCheckpointTicks to
      // multiples of decisionIntervalTicks (the script derives them
      // from --screenshot-every, default 1000, which divides cleanly
      // by the default decisionIntervalTicks=250).
      if (config.screenshotEnabled && screenshotCheckpoints.length > 0) {
        while (
          nextCheckpointIdx < screenshotCheckpoints.length
          && screenshotCheckpoints[nextCheckpointIdx]! <= tickAfter
        ) {
          const checkpointTick = screenshotCheckpoints[nextCheckpointIdx]!;
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
            // Misaligned: the advance overshot the checkpoint —
            // skip the capture (warn-only; playtest-fixes E named the
            // two real causes instead of asserting non-divisibility).
            console.warn(
              `[runLlmPlaytest] checkpoint ${checkpointTick} skipped — the advance landed at ${tickAfter}, `
                + `past the checkpoint. Either the checkpoint is not a multiple of decisionIntervalTicks=`
                + `${config.decisionIntervalTicks}, or this host lacks setPaused and the sim drifted in real time.`,
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
        dispatchEvents: allDispatchEvents,
      };
      trace.push(entry);
      config.onDecision?.(entry);
      decisionsRun += 1;

      if (decision.stopReason === 'cost-budget-exceeded') {
        // M13-#7: report budget death HONESTLY (was laundered into 'stopWhen',
        // which the match-completes oracle reads as a clean completion and
        // prove-fixed reads as a genuine horizon).
        stopReason = 'costBudget';
        errorMessage = 'cost-budget-exceeded';
        break;
      }
    }
  } catch (err) {
    stopReason = 'engineHalt';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Codex impl-1 MED 1: capture an actual final-tick screenshot AFTER
  // the loop exits, not the pre-advance shot from the last decision.
  // The post-hoc conformance probe wants the truly-final visual state,
  // including any engine-halt failure surface.
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
