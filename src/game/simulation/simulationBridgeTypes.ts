// The public shape of a live match — the API reference for everything that
// drives the game (per the docs policy, TypeScript types ARE the reference).
// Split from createSimulationBridge.ts, which owns construction and stays
// under the 500-LOC cap; this file owns only the contract.

import type { EntityRef } from 'civ-engine';
import type { Position } from 'civ-engine';
import type { GameWorld } from './bridge/pureHelpers';
import type { ProjectileState } from './bridge/projectileTypes';
import type { UnitStance } from './unitStance';
import type { MapSize } from './mapGeneration/constants';
import type { AgentBuildingOptions } from './bridge/buildingOptionsOps';
import type { SaveBlob } from './saveSchema';
import type {
  ActionType,
  BuildingType,
  BuildableBuildingType,
  EconomyState,
  HudState,
  MarketActionType,
  MatchState,
  PlacementPreviewState,
  PlayerResources,
  PopulationState,
  ProjectedUnitDeathView,
  ResearchableTechnologyType,
  RenderState,
  SelectionState,
  SimulationDebugSnapshot,
  TrainableUnitType,
  UnitType,
} from './types';

/** Why a `step()` would not advance the world. Each value is a DIFFERENT
 *  condition with a different fix, which is the whole point of naming them:
 *  before v0.3.214 a refused step returned silently and a caller could only
 *  guess from a tick delta of zero, so a manually paused game and a crashed
 *  one looked identical (defect register 2026-09-06).
 *
 *  - `paused`      — `setPaused(true)`; the player's pause, or a harness's.
 *    Clears on `setPaused(false)`.
 *  - `halted`      — a tick threw; the world may be mid-tick, so it is never
 *    stepped again. Terminal for this bridge. Details in
 *    `getHudState().engineHalted`.
 *  - `match-over`  — `getMatchState().outcome !== 'running'`. Terminal, and
 *    an ordinary end to a game rather than a fault.
 *  - `replay`      — a replay bridge, whose playback ReplayController drives;
 *    frames never advance it. Terminal for that bridge.
 */
export type StepRefusal = 'paused' | 'halted' | 'match-over' | 'replay';

/** What one `step()` did. Cheap by construction — no Error, no stack, no
 *  message formatting — because the frame loop calls `step()` every frame and
 *  a halted or paused match refuses on EVERY one of them, forever. The three
 *  refusals are shared frozen constants, so the steady-state path allocates
 *  nothing at all. */
export interface StepReport {
  /** World ticks this call ran. Zero is normal for a short `deltaMs` that did
   *  not fill a tick, so zero on its own is not a refusal — read
   *  `refusedBecause` for that. */
  readonly ticks: number;
  /** Why the world would not advance (further), or `null` when it was willing
   *  and stayed willing. Non-null with `ticks > 0` means the call ran some
   *  ticks and then stopped — a tick failed partway, say. Non-null always
   *  means an identical next call advances nothing until the named condition
   *  changes. */
  readonly refusedBecause: StepRefusal | null;
}

export interface SimulationBridge {
  /** Advance the world by `deltaMs` of wall time. Returns what it did: a
   *  refused step reports WHICH condition refused it rather than returning
   *  silently, so a caller never has to infer "nothing happened" from an
   *  unchanged tick counter. Callers that legitimately do not care — the
   *  frame loop, which re-asks 60 times a second — may discard the report. */
  step(deltaMs: number): StepReport;
  // Spec 2 (annotation-ui v0.1.5) AO-2: read-only access to the engine
  // World instance. Required by RecordingService (binds the SessionRecorder
  // to this World) and AnnotationController.worldRef. Stable for THIS
  // bridge's lifetime — the live bridge cell is reassigned on save/load,
  // so consumers must call `bridgeRef().world` (or equivalent indirection)
  // rather than capturing this reference once.
  readonly world: GameWorld;
  // Spec 2 (annotation-ui v0.1.5) AO-2: manual pause/resume gate. Toggles
  // a NEW closure-local `pauseState.pausedManually` flag (NOT haltState).
  // step() early-returns when pausedManually is true; render projections
  // continue to flow because the pause gate is placed AFTER
  // flushOutOfBandRenderChange. getHudState().engineHalted continues to
  // reflect failure-halt only.
  setPaused(paused: boolean): void;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getHudState(): HudState;
  getEconomyState(): EconomyState;
  /** The map this match is played on, in tiles — a per-match answer since §4's
   *  size ladder, so a camera or a click asks rather than assuming. */
  getMapSize(): MapSize;
  /** Every unit death of the last ten ticks, unfiltered by fog — what the
   *  self-play audit and its villager-death gate count. */
  getRecentUnitDeaths(): readonly ProjectedUnitDeathView[];
  /** The owners whose vision this player also sees — allies via Cartography,
   *  everyone via Spies. Empty without either technology. */
  getSharedVisionOwners(playerId: number): number[];
  /** The owner's civilization name (default-filled for unseeded owners). */
  getPlayerCivilization(playerId: number): string;
  /** Every technology the owner has researched — the coverage census reads it. */
  getResearchedTechnologies(playerId: number): readonly import('./types').ResearchableTechnologyType[];
  /** The owner's real building price — civilization and team discounts in. */
  getConstructionCost(playerId: number, buildingType: BuildingType): Partial<PlayerResources>;
  getPopulationState(playerId: number): PopulationState;
  /** The idle villager bell (v0.3.103): the standing-around count, and the
   *  round-robin next-selection AoE2 binds to '.'. */
  countIdleVillagers(): number;
  countIdleMilitary(): number;
  selectNextIdleMilitary(): boolean;
  selectNextIdleVillager(): boolean;
  /** Control groups (v0.3.104): Ctrl+digit binds, digit recalls survivors. */
  assignControlGroup(digit: number): boolean;
  recallControlGroup(digit: number): boolean;
  getSelectionState(): SelectionState;
  // Spec 2 (annotation-ui v0.1.5) AO-2: parallel selection getters /
  // setters that preserve EntityRef.generation. Used by AnnotationController
  // to resolve the current selection to MarkerRefs.entities, and by
  // MarkerListPanel row clicks to re-select previously-recorded entities.
  // `select` returns void; callers pre-filter stale refs and don't need
  // a "selected anything" signal.
  getSelectedEntityRefs(): readonly EntityRef[];
  select(refs: readonly EntityRef[]): void;
  getMatchState(): MatchState;
  /** Shots currently in the air (spec §10.4). Read-only view for render + tests. */
  getInFlightProjectiles(): readonly ProjectileState[];
  /** The witnessed attack feed (v0.3.109 audio; same view the renderer sees). */
  getRecentUnitAttacks(): readonly import('./types').ProjectedUnitAttackView[];
  /** Delete key (v0.3.114): remove the primary selected OWN unit/building. */
  deleteSelectedEntity(): boolean;
  /** Successful town-bell rings this session (v0.3.116 audio observable). */
  getTownBellRings(): number;
  /** Successful order gestures this session (v0.3.118 ack-click observable). */
  getOrderAcks(): number;
  /** M6 control: set the stance of every owned unit in the selection. */
  setSelectionStance(stance: UnitStance): boolean;
  setSelectionFormation(
    formation: import('./unitFormation').UnitFormation,
  ): boolean;
  /** M6 control: walk the selection to a cell, engaging anything met en route. */
  issueAttackMoveCommand(x: number, y: number): boolean;
  /** Attack-ground (v0.3.117): bombard a cell with every selected blast unit. */
  issueAttackGroundCommand(x: number, y: number): boolean;
  issuePatrolCommand(x: number, y: number): boolean;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  // FU4: probe an entity's current/max HP. Reads the canonical combat
  // (unit) or building-health side-map directly so vitest cases can
  // assert AI-side healing / damage without routing through fog
  // visibility. Returns `null` when the entity has no associated
  // health tracking (e.g., resources, terrain).
  getEntityHealth(id: number): { currentHp: number; maxHp: number } | null;
  selectEntityAtCell(x: number, y: number): boolean;
  selectEntityById(id: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  filterSelectableUnitIds(ids: number[]): number[];
  selectUnitsByIds(ids: number[]): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number, garrison?: boolean): boolean;
  issueContextCommandAtEntity(entityId: number, options?: { garrison?: boolean; forceAttack?: boolean; queue?: boolean }): boolean;
  issueMoveCommand(x: number, y: number, options?: { queue?: boolean }): boolean;
  issueAction(actionType: ActionType): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  /** Tribute (spec §6.8): send resources to another player, fee on top. */
  sendTribute(
    toPlayerId: number,
    resource: import('./types').EconomyResourceKind,
    amount: number,
  ): boolean;
  listTributeTargets(): number[];
  humanTributeFeeRate(): number;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
  confirmBuildingPlacement(x: number, y: number, options?: { queue?: boolean }): boolean;
  // Slice 11: drain the oldest pending command-rejection reason, if any.
  // The HUD polls this every update frame and renders a toast with the
  // returned copy. Returns `null` when no rejection is pending.
  consumeCommandRejection(): string | null;
  // Phase-6.B: single-cell visibility probe for the LLM-agent harness.
  // Returns true if cell (x,y) is currently visible to ownerId. Pure
  // pass-through to the engine's VisibilityMap.isVisible. The agent
  // snapshot composes this into a footprint walk for buildings (any
  // cell in the building's footprint visible → building included)
  // and a single-cell check for units, matching the renderer +
  // target-selection any-cell convention.
  isCellVisibleForOwner(ownerId: number, x: number, y: number): boolean;
  // agent-affordances B (campaign-1 backlog #2): per-building-type
  // research/train options for an owner, with locked research carrying
  // the actionable WHY (shared reason engine with the queue.research
  // validator). Read-side only; consumed by the agent snapshot.
  getAgentBuildingOptions(ownerId: number): AgentBuildingOptions;
  // agent-affordances C (campaign-1 backlog #3): deterministic open
  // placement anchors near a point, fog-gated by the owner's visibility
  // (every footprint cell must be currently visible). Consumed by the
  // agent snapshot's placementHints.
  findOpenPlacementAnchorsNear(
    ownerId: number,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    max: number,
  ): Position[];
  // LLM-agent harness (Phase 1.B): the in-place pendingCommands queue
  // the in-game AI pushes intentions onto. Exposed publicly so
  // `__AOE2_TEST__.agent.dispatchAgentCommand` can shape-validate +
  // push without a parallel surface. Mutate-in-place semantics
  // (push to enqueue; drain via dispatcher between ticks); never
  // reassign the array reference.
  readonly pendingCommands: Array<{ type: string; data: Record<string, unknown> }>;
  // LLM-agent harness (Phase 1 impl-1 H1): subscribe to per-command
  // dispatch results so the agent runner can correlate dispatched
  // commands with semantic rejections WITHOUT competing with the
  // HUD's `consumeCommandRejection` FIFO. The observer fires once per
  // drained command (between ticks), with `accepted: false +
  // rejectionReason` for rejections. Pass `null` to clear. Only one
  // observer at a time; the agent harness owns this slot.
  setAgentDispatchObserver(
    observer: import('./dispatcher').AgentDispatchObserver | null,
  ): void;
  // Slice 11: snapshot for the F2 debug overlay. Returns the per-frame
  // data the overlay draws: pathing targets keyed by unit id, AI plan
  // summaries per owner, and tick-level perf metrics. Cheap to call; the
  // overlay renderer pulls this every frame.
  getDebugSnapshot(): SimulationDebugSnapshot;
  saveGame(): SaveBlob;
}
