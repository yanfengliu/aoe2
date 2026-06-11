// LLM-agent harness surface (Phase 1.B), split out of
// browserTestApi.ts when the ownership-enforcement work (playtest-fixes
// iter-1) pushed that file past the 500-line budget. Hosts the
// `__AOE2_TEST__.agent` sub-API: bounded snapshot, command dispatch
// with ownership enforcement, dispatch-event log, canvas bbox, and
// recorder-bundle access. Production app code never calls these.

import type { GameScene } from '../../phaser/scenes/GameScene';
import { TPS } from '../../game/simulation/prototypeScenario';
import type { RecordingService } from '../../game/recording/RecordingService';
import type { AgentStateSnapshot, CommandDispatchResult } from '../../game/playtest/types';
import type {
  BuildingComponent as OwnedBuildingComponent,
  ResourceComponent as OwnedResourceComponent,
  UnitComponent as OwnedUnitComponent,
} from '../../game/simulation/types';
import { buildAgentSnapshot } from '../../game/playtest/agentSnapshot';
import {
  checkAgentActorOwnership,
  validateAgentCommandShape,
  type AgentEntityOwnerLookup,
} from './agentCommandValidator';
// Type-only import — circular at the value level is avoided; the type
// cycle is erased at compile time.
import type { BrowserTestBridge } from './browserTestApi';

// LLM-agent harness surface (Phase 1.B). Methods used by
// `scripts/playtest-llm.mjs` Playwright runner. Production app does
// not call any of them.
export interface AgentDispatchEventLog {
  commandType: string;
  accepted: boolean;
  rejectionReason?: string;
  rejectionMessage?: string;
}

export interface BrowserTestAgentApi {
  /** Bounded state view shaped for prompt-token efficiency.
   *  See `docs/threads/done/llm-agent-playtest/DESIGN.md` §1.
   *  Phase-6.B (impl-2 M7): `enemies` is filtered by per-owner
   *  visibility (engine `VisibilityMap`) by default. Pass
   *  `{omniscient: true}` to revert to cheat-mode global ground-truth
   *  (opt-in via --omniscient; the corpus smoke row runs fog-filtered
   *  since 2026-06-10). */
  snapshotForAgent(ownerId: number, options?: { omniscient?: boolean }): AgentStateSnapshot;
  /** On-page canvas bounding box in CSS pixels. The runner calls
   *  `page.screenshot({ clip: bbox })` with this. */
  getCanvasBboxForScreenshot(): { x: number; y: number; width: number; height: number };
  /** Push a structured command onto pendingCommands. Shape validation
   *  always runs; when `options.expectedOwner` is provided, the acting
   *  entity's ownership is enforced too (reject with reason
   *  'not-owned') — the engine's semantic validators have no actor
   *  identity, so without this the agent could command enemy entities
   *  using ids the snapshot legitimately shows it. */
  dispatchAgentCommand(
    command: unknown,
    options?: { expectedOwner?: number },
  ): Promise<CommandDispatchResult>;
  /** Live RecordingService.bundle(). For large bundles the runner
   *  pulls JSON.stringify(...) of this through chunked page.evaluate
   *  slices (playtest-fixes D) — Playwright's apiRequestContext cannot
   *  fetch blob: URLs, so the old blob-export path was removed. */
  getRecorderBundle(): import('civ-engine').SessionBundle;
  /** Drain accumulated dispatch events (one per command processed
   *  through `drainPendingCommands` since the last call). The runner
   *  calls this after each `advanceTicks` to correlate dispatched
   *  commands with semantic rejections — does NOT compete with the
   *  HUD's `consumeCommandRejection` FIFO. (impl-1 H1.) */
  drainAgentDispatchLog(): AgentDispatchEventLog[];
  /** Phase-6.D: per-owner unit/building counts at the current tick.
   *  Used by the winner oracle to score the game outcome. Reads from
   *  the bridge's existing economy-state surface — no engine-internal
   *  coupling. */
  getEntityCountsByOwner(): Record<number, { units: number; buildings: number }>;
}

export function makeAgentApi(
  getBridge: () => BrowserTestBridge,
  scene: GameScene,
  getRecording: () => RecordingService,
): BrowserTestAgentApi {
  // Per-runner dispatch log. The agent observer fires once per drained
  // command between ticks; we accumulate into this array and drain on
  // demand. The observer is reattached lazily on every dispatch so a
  // bridge swap (save/load) doesn't strand the subscription.
  let dispatchLog: AgentDispatchEventLog[] = [];
  function ensureObserverAttached(): void {
    getBridge().setAgentDispatchObserver((event) => {
      // playtest-fixes iter-1 (Codex MED): the pending queue also
      // carries AI / auto-aggression intentions. Only agent-issued
      // commands belong in the agent's feedback log — without this
      // filter, unrelated intentions masquerade as "your previous
      // commands" in the next tactical prompt.
      if (!event.agentIssued) return;
      dispatchLog.push({
        commandType: String(event.commandType),
        accepted: event.accepted,
        rejectionReason: event.rejectionReason,
        rejectionMessage: event.rejectionMessage,
      });
    });
  }

  return {
    snapshotForAgent: (
      ownerId: number,
      options?: { omniscient?: boolean },
    ): AgentStateSnapshot => {
      scene.syncFromBridge(true);
      const bridge = getBridge();
      const economy = bridge.getEconomyState();
      const selection = bridge.getSelectionState();
      const renderTick = bridge.getRenderState().tick;
      // Camera bbox in world coords; pixel bbox + worldToScreen sample
      // table for the visible cells (caps at 64 entries to keep prompt
      // tokens bounded).
      const camera = scene.getCameraState();
      const canvasRect = getCanvasRect();
      // CameraState.viewX/Y/Width/Height is the world-coords viewport
      // exposed by GameScene.getCameraState — convert to integer cell
      // bbox for the snapshot.
      const worldBbox = camera
        ? {
            minX: Math.floor(camera.viewX),
            minY: Math.floor(camera.viewY),
            maxX: Math.ceil(camera.viewX + camera.viewWidth),
            maxY: Math.ceil(camera.viewY + camera.viewHeight),
          }
        : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      const worldToScreenSamples: Array<{
        cellX: number;
        cellY: number;
        pixelX: number;
        pixelY: number;
      }> = [];
      const STEP = 4;
      for (let cy = worldBbox.minY; cy <= worldBbox.maxY; cy += STEP) {
        for (let cx = worldBbox.minX; cx <= worldBbox.maxX; cx += STEP) {
          if (worldToScreenSamples.length >= 64) break;
          const pt = scene.getScreenPointForCell(cx, cy);
          if (pt) worldToScreenSamples.push({ cellX: cx, cellY: cy, pixelX: pt.x, pixelY: pt.y });
        }
      }
      // Phase-6.B (impl-2 M7): per-owner visibility probe via the
      // bridge's new isCellVisibleForOwner. Pure pass-through to the
      // engine's VisibilityMap; combined with `omniscient` flag in
      // buildAgentSnapshot to honor the cheat-mode cap.
      const visibility = (
        probeOwnerId: number,
        x: number,
        y: number,
      ): boolean => bridge.isCellVisibleForOwner(probeOwnerId, x, y);
      return buildAgentSnapshot({
        ownerId,
        tick: renderTick,
        tps: TPS,
        economy,
        selection,
        screenMapping: {
          worldBbox,
          pixelBbox: canvasRect,
          worldToScreen: worldToScreenSamples,
        },
        visibility,
        omniscient: options?.omniscient ?? false,
      });
    },

    getCanvasBboxForScreenshot: () => getCanvasRect(),

    dispatchAgentCommand: async (
      command: unknown,
      options?: { expectedOwner?: number },
    ): Promise<CommandDispatchResult> => {
      const result = validateAgentCommandShape(command, {
        ownerRangeInclusive: { min: 1, max: 8 },
      });
      if (!result.accepted) return result;
      if (typeof options?.expectedOwner === 'number') {
        const world = getBridge().world;
        const getOwner: AgentEntityOwnerLookup = (entityId, kind) => {
          if (kind === 'unit') {
            return world.getComponent<OwnedUnitComponent>(entityId, 'unit')?.owner ?? null;
          }
          if (kind === 'building') {
            return world.getComponent<OwnedBuildingComponent>(entityId, 'building')?.owner ?? null;
          }
          return world.getComponent<OwnedResourceComponent>(entityId, 'resource')?.owner ?? null;
        };
        const owned = checkAgentActorOwnership(
          result.commandKind as Parameters<typeof checkAgentActorOwnership>[0],
          result.normalized,
          options.expectedOwner,
          getOwner,
        );
        if (!owned.ok) {
          return { accepted: false, reason: 'not-owned', details: owned.details };
        }
      }
      ensureObserverAttached();
      const bridge = getBridge();
      bridge.pendingCommands.push({
        type: result.commandKind as string,
        data: result.normalized,
        agentIssued: true,
      });
      return result;
    },

    drainAgentDispatchLog: () => {
      const events = dispatchLog;
      dispatchLog = [];
      return events;
    },

    getRecorderBundle: () => {
      const recording = getRecording();
      const bundle = recording.bundle();
      if (!bundle) {
        throw new Error('No recorder bundle yet — start() must complete before getRecorderBundle().');
      }
      return bundle;
    },

    getEntityCountsByOwner: () => {
      // Phase-6.D: aggregate live unit/building counts from the
      // bridge's economy-state surface. Pure read; no engine-internal
      // coupling. The winner oracle in `src/game/playtest/winnerOracle.ts`
      // consumes this shape.
      const economy = getBridge().getEconomyState();
      const counts: Record<number, { units: number; buildings: number }> = {};
      for (const u of economy.units) {
        const slot = counts[u.owner] ?? { units: 0, buildings: 0 };
        slot.units += 1;
        counts[u.owner] = slot;
      }
      for (const b of economy.buildings) {
        const slot = counts[b.owner] ?? { units: 0, buildings: 0 };
        slot.buildings += 1;
        counts[b.owner] = slot;
      }
      return counts;
    },
  };
}

function getCanvasRect(): { x: number; y: number; width: number; height: number } {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
  const rect = canvas.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}
