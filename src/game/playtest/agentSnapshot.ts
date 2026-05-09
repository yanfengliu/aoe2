// Bounded agent-state snapshot for the LLM-agent playtest harness.
// Composed from the bridge's existing read surfaces; capped at limits
// per docs/threads/current/llm-agent-playtest/DESIGN.md §1.

import type {
  AgentEntitySummary,
  AgentPlayerState,
  AgentScreenMapping,
  AgentStateSnapshot,
} from './types';
import type { EconomyState, SelectionState } from '../simulation/types';

const MAX_ENEMIES = 200;
const MAX_SELECTION_ENTRIES = 16;
const MAX_QUEUED_PRODUCTION_ENTRIES = 64;
const MAX_QUEUE_LENGTH_PER_BUILDING = 16;

// Enemies = units / buildings with `owner !== ownerId`, capped.
// IMPORTANT: this is global ground-truth, NOT visibility-filtered.
// `EconomyState` (built by `economyStateOps.ts`) iterates the world
// directly without a fog-of-war predicate, so the snapshot leaks
// hidden enemy positions. Acceptable for the single-LLM-vs-passive-
// human smoke baseline (the LLM is the only active player; "fog" is
// not meaningful), and the multimodal screenshot the LLM also receives
// is fog-respecting so the visual signal is correct. Per-owner
// visibility-gating is a Phase-6 follow-up: see DESIGN.md
// "Phase-6 follow-ups". impl-1 H3 (Claude).
function enemiesFor(
  ownerId: number,
  economy: EconomyState,
  cap: number,
): AgentEntitySummary[] {
  const seen = new Set<number>();
  const out: AgentEntitySummary[] = [];
  for (const u of economy.units) {
    if (u.owner === ownerId) continue;
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push({ entityId: u.id, ownerId: u.owner, kind: u.unitType, position: { x: u.x, y: u.y } });
    if (out.length >= cap) return out;
  }
  for (const b of economy.buildings) {
    if (b.owner === ownerId) continue;
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push({ entityId: b.id, ownerId: b.owner, kind: b.buildingType, position: { x: b.x, y: b.y } });
    if (out.length >= cap) return out;
  }
  return out;
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
  const { ownerId, tick, tps, economy, selection, screenMapping } = inputs;
  assertEconomyShape(economy);
  return {
    tick,
    elapsedMmSs: elapsedMmSs(tick, tps),
    perPlayer: perPlayerStates(economy),
    selection: summarizeSelection(selection, MAX_SELECTION_ENTRIES),
    enemies: enemiesFor(ownerId, economy, MAX_ENEMIES),
    queuedProduction: queuedProductionOf(economy),
    screenMapping,
  };
}
