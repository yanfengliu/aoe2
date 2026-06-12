// Bounded agent-state snapshot for the LLM-agent playtest harness.
// Composed from the bridge's existing read surfaces; capped at limits
// per docs/threads/done/llm-agent-playtest/DESIGN.md §1.

import type {
  AgentEntitySummary,
  AgentOwnBuildingSummary,
  AgentOwnUnitSummary,
  AgentPlacementHints,
  AgentPlayerState,
  AgentResourceSummary,
  AgentScreenMapping,
  AgentStateSnapshot,
} from './types';
import type { EconomyState, SelectionState } from '../simulation/types';
import type { AgentBuildingOptions } from '../simulation/createSimulationBridge';
import { resourceKindToEconomyResource } from '../simulation/prototypeEconomyRules';

const MAX_ENEMIES = 200;
const MAX_SELECTION_ENTRIES = 16;
const MAX_QUEUED_PRODUCTION_ENTRIES = 64;
const MAX_QUEUE_LENGTH_PER_BUILDING = 16;
// playtest-fixes A: own-entity + resource caps. Sized so the rendered
// JSON stays bounded (~20 tokens/entry) while covering a full mid-game
// army + base and the local resource cluster.
const MAX_OWN_UNITS = 150;
const MAX_OWN_BUILDINGS = 64;
const MAX_NEARBY_RESOURCES = 64;

// Phase-6.B (impl-2 M7): visibility predicate signature. Returns true
// if `ownerId` can currently see cell (x,y). When the predicate is
// undefined OR `omniscient: true` is passed to buildAgentSnapshot, the
// snapshot reverts to global ground-truth (intentional cheat-mode —
// opt-in via --omniscient; since 2026-06-10 the corpus smoke row runs
// fog-filtered like every default run). When provided, `enemiesFor` filters out enemies whose
// footprint sits entirely in fog so the LLM doesn't get a free scout.
export type VisibilityProbe = (ownerId: number, x: number, y: number) => boolean;

// Multi-cell footprint visibility: true if ANY cell of the
// (anchorX, anchorY, w, h) rectangle is visible to ownerId. Mirrors
// the engine's `isFootprintVisible` semantics from
// `src/game/simulation/bridge/pureHelpers.ts` so a building visible
// only at a far footprint corner still surfaces in the snapshot —
// the renderer + target selection use the same any-cell rule, and
// the LLM context would otherwise be inconsistent with what the
// screenshot shows (Codex impl-1 MED: building anchor-only check).
function isFootprintVisible(
  visibility: VisibilityProbe,
  ownerId: number,
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
): boolean {
  const fx = Math.floor(anchorX);
  const fy = Math.floor(anchorY);
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      if (visibility(ownerId, fx + dx, fy + dy)) return true;
    }
  }
  return false;
}

// Enemies = units / buildings with `owner !== ownerId`, capped.
// When `visibility` is provided, filtered by per-cell (units) or
// per-footprint (buildings) visibility; when undefined, the cheat-
// mode global view is preserved (impl-1 H3 rationale).
function enemiesFor(
  ownerId: number,
  economy: EconomyState,
  cap: number,
  visibility?: VisibilityProbe,
): AgentEntitySummary[] {
  const seen = new Set<number>();
  const out: AgentEntitySummary[] = [];
  for (const u of economy.units) {
    if (u.owner === ownerId) continue;
    if (seen.has(u.id)) continue;
    // Units are 1x1 footprints — single-cell probe suffices.
    if (visibility && !visibility(ownerId, Math.floor(u.x), Math.floor(u.y))) continue;
    seen.add(u.id);
    out.push({ entityId: u.id, ownerId: u.owner, kind: u.unitType, position: { x: u.x, y: u.y } });
    if (out.length >= cap) return out;
  }
  for (const b of economy.buildings) {
    if (b.owner === ownerId) continue;
    if (seen.has(b.id)) continue;
    // Buildings span multiple cells — visible if ANY footprint cell
    // is visible (matches engine renderer + target selection rules).
    if (
      visibility
      && !isFootprintVisible(
        visibility,
        ownerId,
        b.x,
        b.y,
        b.footprintWidth,
        b.footprintHeight,
      )
    ) continue;
    seen.add(b.id);
    out.push({ entityId: b.id, ownerId: b.owner, kind: b.buildingType, position: { x: b.x, y: b.y } });
    if (out.length >= cap) return out;
  }
  return out;
}

// playtest-fixes A: the agent's own forces, with real entityIds. Never
// visibility-filtered — you always know your own units. These are what
// the tactical tool schemas' integer ids must come from; omitting them
// forced the model to invent ids (42/42 rejections, 2026-06-09 run).
function ownUnitsFor(ownerId: number, economy: EconomyState, cap: number): AgentOwnUnitSummary[] {
  const out: AgentOwnUnitSummary[] = [];
  for (const u of economy.units) {
    if (u.owner !== ownerId) continue;
    out.push({
      entityId: u.id,
      kind: String(u.unitType),
      position: { x: u.x, y: u.y },
      task: String(u.task),
    });
    if (out.length >= cap) break;
  }
  return out;
}

function ownBuildingsFor(
  ownerId: number,
  economy: EconomyState,
  cap: number,
): AgentOwnBuildingSummary[] {
  const out: AgentOwnBuildingSummary[] = [];
  for (const b of economy.buildings) {
    if (b.owner !== ownerId) continue;
    out.push({
      entityId: b.id,
      kind: String(b.buildingType),
      position: { x: b.x, y: b.y },
      isComplete: b.isComplete,
    });
    if (out.length >= cap) break;
  }
  return out;
}

// Gatherable resources, visibility-filtered like enemies (a fog-hidden
// gold pile must not leak), sorted nearest-first relative to the
// agent's first own building (the TC for normal starts) so the cap
// keeps the actionable local cluster rather than far-corner piles.
function nearbyResourcesFor(
  ownerId: number,
  economy: EconomyState,
  cap: number,
  visibility?: VisibilityProbe,
): AgentResourceSummary[] {
  const anchor = economy.buildings.find((b) => b.owner === ownerId)
    ?? economy.units.find((u) => u.owner === ownerId);
  const ax = anchor?.x ?? 0;
  const ay = anchor?.y ?? 0;
  const candidates: Array<AgentResourceSummary & { d2: number }> = [];
  for (const r of economy.resources) {
    // playtest-fixes iter-2 (Codex MED 2): only list entities a villager
    // can actually harvest — wolves/relics map to null economy resources
    // and would otherwise look like valid `unit.gather` targets.
    if (resourceKindToEconomyResource(r.resourceType) === null) continue;
    if (visibility && !visibility(ownerId, Math.floor(r.x), Math.floor(r.y))) continue;
    const dx = r.x - ax;
    const dy = r.y - ay;
    candidates.push({
      entityId: r.id,
      kind: String(r.resourceType),
      position: { x: r.x, y: r.y },
      amount: r.amount,
      d2: dx * dx + dy * dy,
    });
  }
  candidates.sort((a, b) => a.d2 - b.d2);
  return candidates.slice(0, cap).map((c) => ({
    entityId: c.entityId,
    kind: c.kind,
    position: c.position,
    amount: c.amount,
  }));
}

function summarizeSelection(selection: SelectionState, cap: number): AgentEntitySummary[] {
  const out: AgentEntitySummary[] = [];
  const ids = selection.selectedEntityIds.slice(0, cap);
  for (const id of ids) {
    out.push({
      entityId: id,
      ownerId: selection.owner ?? 0,
      kind: String(selection.selectedEntityType ?? selection.selectedKind ?? 'unknown'),
      position: { x: selection.tileX ?? 0, y: selection.tileY ?? 0 },
    });
  }
  return out;
}

function ageOf(economy: EconomyState, ownerId: number): AgentPlayerState['age'] {
  const raw = economy.ages[ownerId];
  switch (raw) {
    case 'feudal-age':
    case 'castle-age':
    case 'imperial-age':
      return raw;
    default:
      return 'dark-age';
  }
}

function perPlayerStates(economy: EconomyState): AgentPlayerState[] {
  const owners = new Set<number>();
  for (const k of Object.keys(economy.playerResources)) owners.add(Number(k));
  for (const k of Object.keys(economy.population)) owners.add(Number(k));
  const out: AgentPlayerState[] = [];
  for (const ownerId of [...owners].sort((a, b) => a - b)) {
    const villagerCountByTask: Record<string, number> = {};
    for (const v of economy.villagers) {
      if (v.owner !== ownerId) continue;
      const key = String(v.task);
      villagerCountByTask[key] = (villagerCountByTask[key] ?? 0) + 1;
    }
    const buildingCountByType: Record<string, number> = {};
    for (const b of economy.buildings) {
      if (b.owner !== ownerId) continue;
      const key = String(b.buildingType);
      buildingCountByType[key] = (buildingCountByType[key] ?? 0) + 1;
    }
    const militaryCountByType: Record<string, number> = {};
    for (const u of economy.units) {
      if (u.owner !== ownerId) continue;
      if (u.unitType === 'villager') continue;
      const key = String(u.unitType);
      militaryCountByType[key] = (militaryCountByType[key] ?? 0) + 1;
    }
    const r = economy.playerResources[ownerId] ?? { wood: 0, food: 0, gold: 0, stone: 0 };
    const pop = economy.population[ownerId] ?? { current: 0, cap: 0 };
    out.push({
      ownerId,
      age: ageOf(economy, ownerId),
      resources: { wood: r.wood, food: r.food, gold: r.gold, stone: r.stone },
      villagerCountByTask,
      buildingCountByType,
      militaryCountByType,
      populationCurrent: pop.current,
      populationCap: pop.cap,
    });
  }
  return out;
}

function queuedProductionOf(economy: EconomyState): AgentStateSnapshot['queuedProduction'] {
  const out: AgentStateSnapshot['queuedProduction'] = [];
  for (const b of economy.buildings) {
    if (!b.queue || b.queue.length === 0) continue;
    if (out.length >= MAX_QUEUED_PRODUCTION_ENTRIES) break;
    out.push({
      buildingId: b.id,
      ownerId: b.owner,
      queue: b.queue
        .slice(0, MAX_QUEUE_LENGTH_PER_BUILDING)
        .map((entry) => String(entry.unitType ?? entry.technologyType ?? 'unknown')),
    });
  }
  return out;
}

function elapsedMmSs(tick: number, tps: number): string {
  const totalSeconds = Math.floor(tick / Math.max(1, tps));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export interface AgentSnapshotInputs {
  ownerId: number;
  tick: number;
  tps: number;
  economy: EconomyState;
  selection: SelectionState;
  screenMapping: AgentScreenMapping;
  // Phase-6.B (impl-2 M7): per-owner visibility probe + opt-in
  // omniscient (cheat-mode) flag. When `omniscient: true` (default
  // false) or `visibility` is undefined, `enemies` is global
  // ground-truth (opt-in cheat mode). Otherwise enemies are filtered through the probe so
  // fog-shrouded units/buildings don't leak.
  visibility?: VisibilityProbe;
  omniscient?: boolean;
  // agent-affordances B/C: computed bridge-side (buildingOptionsOps /
  // findOpenPlacementAnchorsNear) and passed through verbatim so this
  // builder stays pure. Both are already fog-honest at the source.
  buildingOptions?: AgentBuildingOptions;
  placementHints?: AgentPlacementHints | null;
}

// Phase-6.A.2 (impl-2 M2): fail loud when the EconomyState shape that
// the snapshot embeds in the LLM prompt is missing a load-bearing
// field. Without this guard, a future schema change that renames or
// drops one of these fields silently degrades the prompt — the field
// becomes `undefined`, the LLM keeps running but with weaker context,
// and there's no test signal because the runtime doesn't crash. This
// guard catches it on the very first decision instead.
//
// The check is intentionally a shape probe (presence + type), not a
// content check; we don't want to block on legitimately empty arrays
// during early game ticks.
// Plain-record predicate: rejects null, arrays, and Map (Codex impl-1
// MED 3). The snapshot consumes these fields with `Object.keys(...)`
// and `record[ownerId]` indexing — those would silently degrade if the
// engine swapped to Map-backed accessors. Forcing plain-object form
// catches that drift.
function isPlainRecord(v: unknown): boolean {
  return (
    typeof v === 'object'
    && v !== null
    && !Array.isArray(v)
    && !(v instanceof Map)
    && !(v instanceof Set)
  );
}

function assertEconomyShape(economy: EconomyState): void {
  const required: Array<{ key: keyof EconomyState; isType: (v: unknown) => boolean }> = [
    { key: 'units', isType: Array.isArray },
    { key: 'buildings', isType: Array.isArray },
    { key: 'villagers', isType: Array.isArray },
    { key: 'resources', isType: Array.isArray },
    { key: 'ages', isType: isPlainRecord },
    { key: 'playerResources', isType: isPlainRecord },
    { key: 'population', isType: isPlainRecord },
  ];
  for (const { key, isType } of required) {
    const value = (economy as unknown as Record<string, unknown>)[key as string];
    if (!isType(value)) {
      throw new Error(
        `[agent-snapshot] schema drift detected: EconomyState.${String(key)} is missing or wrong type. `
          + `If the engine renamed/removed this field, update buildAgentSnapshot accordingly.`,
      );
    }
  }
}

export function buildAgentSnapshot(inputs: AgentSnapshotInputs): AgentStateSnapshot {
  const {
    ownerId,
    tick,
    tps,
    economy,
    selection,
    screenMapping,
    visibility,
    omniscient,
    buildingOptions,
    placementHints,
  } = inputs;
  assertEconomyShape(economy);
  // omniscient=true short-circuits the visibility filter so the enemy
  // and resource lists revert to global ground-truth (opt-in cheat
  // mode). When false (default) AND a probe is provided,
  // enemies + resources get fog-filtered. Own entities are NEVER
  // filtered (playtest-fixes A).
  const fogVisibility = omniscient ? undefined : visibility;
  return {
    tick,
    elapsedMmSs: elapsedMmSs(tick, tps),
    perPlayer: perPlayerStates(economy),
    selection: summarizeSelection(selection, MAX_SELECTION_ENTRIES),
    ownUnits: ownUnitsFor(ownerId, economy, MAX_OWN_UNITS),
    ownBuildings: ownBuildingsFor(ownerId, economy, MAX_OWN_BUILDINGS),
    nearbyResources: nearbyResourcesFor(ownerId, economy, MAX_NEARBY_RESOURCES, fogVisibility),
    enemies: enemiesFor(ownerId, economy, MAX_ENEMIES, fogVisibility),
    queuedProduction: queuedProductionOf(economy),
    screenMapping,
    // agent-affordances B/C: pass-throughs (undefined stays undefined so
    // older hosts/fixtures serialize identically).
    ...(buildingOptions !== undefined ? { buildingOptions } : {}),
    ...(placementHints !== undefined ? { placementHints } : {}),
  };
}
