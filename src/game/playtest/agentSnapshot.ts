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

const MAX_VISIBLE_ENEMIES = 200;
const MAX_SELECTION_ENTRIES = 16;

// Visible enemies = units / buildings with `owner !== humanOwnerId` that
// the snapshot caller has visibility on. The bridge already filters its
// EconomyState to entities the human player can see (visibility-gated
// projection); we just need to drop our own units. The agent-side
// "enemy" framing is per-LLM-owner; if we ever support multiple LLMs,
// pass each owner its own filter.
function visibleEnemiesFor(
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
    out.push({
      buildingId: b.id,
      ownerId: b.owner,
      queue: b.queue.map((entry) => String(entry.unitType ?? entry.technologyType ?? 'unknown')),
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

export function buildAgentSnapshot(inputs: AgentSnapshotInputs): AgentStateSnapshot {
  const { ownerId, tick, tps, economy, selection, screenMapping } = inputs;
  return {
    tick,
    elapsedMmSs: elapsedMmSs(tick, tps),
    perPlayer: perPlayerStates(economy),
    selection: summarizeSelection(selection, MAX_SELECTION_ENTRIES),
    visibleEnemies: visibleEnemiesFor(ownerId, economy, MAX_VISIBLE_ENEMIES),
    queuedProduction: queuedProductionOf(economy),
    screenMapping,
  };
}
