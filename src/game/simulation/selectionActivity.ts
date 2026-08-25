/**
 * Pure activity-derivation helpers for the selection panel.
 *
 * All functions are side-effect-free. They accept an explicit `sources` bag
 * instead of closing over bridge scope, making them independently testable
 * and preventing accidental coupling to the bridge's mutable state.
 */

import { isMonasticUnit } from './monasticUnits';
import type { EntityRef, World } from 'civ-engine';

import { resourceKindToEconomyResource } from './prototypeEconomyRules';
import { MONK_FAITH_MAX } from './bridge/bridgeConstants';
import type {
  BuildingComponent,
  GathererComponent,
  ProductionQueueEntry,
  ResourceComponent,
  UnitComponent,
} from './types';
import type {
  ConstructionState,
  MonkTask,
  TrebuchetPackState,
  UnitCommand,
} from './createSimulationBridge';

export interface ActivityTarget {
  kind: 'unit' | 'building' | 'resource' | 'relic' | 'economy-resource' | 'technology';
  type: string;
}

export interface ActivityPayload {
  verb: string;
  target: ActivityTarget | null;
}

export interface SelectionActivitySources {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  world: World<any, any, any>;
  humanPlayerId: number;
  unitCommands: Map<number, UnitCommand>;
  monkTasks: Map<number, MonkTask>;
  /** Monk faith, monkId -> current. Absent means full (see monkFaithCodec). */
  monkFaith: Map<number, number>;
  monkCarriedRelic: Map<number, number>;
  trebuchetPackStates: Map<number, TrebuchetPackState>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  constructionStates: Map<number, ConstructionState>;
  getCurrentEntityId: (ref: EntityRef) => number | null;
}

// ─── Verb priority tiers (for multi-selection breakdown ordering) ──────────
// Lower number = displayed first. Unknown verbs fall to tier 99 (sorted last).

const VERB_PRIORITY: Record<string, number> = {
  // Tier 0 — urgent / combat
  attacking: 0,
  // Tier 1 — productive economy
  building: 1,
  gathering: 1,
  'dropping off': 1,
  // Tier 2 — building production states
  training: 2,
  researching: 2,
  // Tier 3 — specialists
  healing: 3,
  converting: 3,
  retrieving: 3,
  carrying: 3,
  // Tier 4 — transitional
  moving: 4,
  packing: 4,
  unpacking: 4,
  // Tier 5 — slack
  idle: 5,
};

function verbPriority(verb: string): number {
  return VERB_PRIORITY[verb] ?? 99;
}

// ─── Private helper ────────────────────────────────────────────────────────

function resolveTargetEntityRef(
  sources: SelectionActivitySources,
  ref: EntityRef | undefined,
): ActivityTarget | null {
  if (!ref) return null;
  const id = sources.getCurrentEntityId(ref);
  if (id === null) return null;
  const unit = sources.world.getComponent<UnitComponent>(id, 'unit');
  if (unit) return { kind: 'unit', type: unit.unitType };
  const building = sources.world.getComponent<BuildingComponent>(id, 'building');
  if (building) return { kind: 'building', type: building.buildingType };
  const resource = sources.world.getComponent<ResourceComponent>(id, 'resource');
  if (resource) return { kind: 'resource', type: resource.resourceType };
  return null;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function computeUnitActivity(
  sources: SelectionActivitySources,
  id: number,
  unit: UnitComponent,
): ActivityPayload {
  // A monk below full faith is RESTING, and that outranks whatever task it is
  // holding: a monk standing next to the enemy it cannot convert yet would
  // otherwise report "Converting" while nothing happens (spec §12).
  if (
    isMonasticUnit(unit.unitType)
    && (sources.monkFaith.get(id) ?? MONK_FAITH_MAX) < MONK_FAITH_MAX
  ) {
    return { verb: 'resting', target: null };
  }
  const monkTask = sources.monkTasks.get(id);
  if (monkTask) {
    switch (monkTask.kind) {
      case 'heal': {
        const target = resolveTargetEntityRef(sources, monkTask.targetEntityRef);
        return { verb: 'healing', target };
      }
      case 'convert': {
        const target = resolveTargetEntityRef(sources, monkTask.targetEntityRef);
        return { verb: 'converting', target };
      }
      case 'pickup':
        return { verb: 'retrieving', target: null };
      case 'deposit':
        return { verb: 'carrying', target: null };
    }
  }

  const treb = sources.trebuchetPackStates.get(id);
  if (treb && treb.transitionTicksRemaining > 0) {
    return treb.packed
      ? { verb: 'unpacking', target: null }
      : { verb: 'packing', target: null };
  }

  const cmd = sources.unitCommands.get(id);
  if (cmd) {
    if (cmd.type === 'attack') {
      const target = resolveTargetEntityRef(sources, cmd.targetEntityRef);
      return { verb: 'attacking', target };
    }
    if (cmd.type === 'build') {
      const target = resolveTargetEntityRef(sources, cmd.buildingRef);
      return { verb: 'building', target };
    }
    if (cmd.type === 'move') {
      return { verb: 'moving', target: null };
    }
    if (cmd.type === 'trade') {
      const target = resolveTargetEntityRef(sources, cmd.buildingRef);
      return { verb: 'trading', target };
    }
  }

  // A monk that has picked up a relic but has no current task or active
  // command is still "carrying" the relic — surface that state instead of
  // falling through to 'idle'. Phase 1B monk.contextAtEntity: the bridge
  // facade queues the deposit command instead of mutating monkTasks
  // synchronously, so HUD-time activity reads see the carry state alone
  // until the handler runs at the start of the next step. Positioned
  // AFTER unitCommands so an active move order on a carrying monk still
  // wins ('moving') — the player's explicit intent takes precedence over
  // the passive carry state.
  if (sources.monkCarriedRelic.has(id)) {
    return { verb: 'carrying', target: null };
  }

  // Villager gathering state lives on GathererComponent, not unitCommands.
  // `issueUnitGatherCommand` clears unitCommands and sets gatherer.task directly.
  if (unit.unitType === 'villager') {
    const gatherer = sources.world.getComponent<GathererComponent>(id, 'gatherer');
    if (gatherer) {
      if (gatherer.task === 'to-resource' || gatherer.task === 'gathering') {
        if (gatherer.targetResourceId !== null) {
          const r = sources.world.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');
          if (r) {
            const econ = resourceKindToEconomyResource(r.resourceType);
            if (econ) return { verb: 'gathering', target: { kind: 'economy-resource', type: econ } };
          }
        }
        if (gatherer.desiredResource) return { verb: 'gathering', target: { kind: 'economy-resource', type: gatherer.desiredResource } };
        return { verb: 'gathering', target: null };
      }
      if (gatherer.task === 'to-dropoff' && gatherer.carriedResource && gatherer.carriedAmount > 0) {
        return { verb: 'dropping off', target: { kind: 'economy-resource', type: gatherer.carriedResource } };
      }
    }
  }

  return { verb: 'idle', target: null };
}

export function getBuildingActivity(
  sources: SelectionActivitySources,
  id: number,
): ActivityPayload {
  const construction = sources.constructionStates.get(id);
  if (construction && !construction.isComplete) {
    return { verb: 'under construction', target: null };
  }

  const queue = sources.productionQueues.get(id);
  const head = queue && queue.length > 0 ? queue[0] : null;
  if (head) {
    if (head.kind === 'unit' && head.unitType) {
      return { verb: 'training', target: { kind: 'unit', type: head.unitType } };
    }
    if (head.kind === 'technology' && head.technologyType) {
      return { verb: 'researching', target: { kind: 'technology', type: head.technologyType } };
    }
  }

  return { verb: 'idle', target: null };
}

export function getSelectionActivityBreakdown(
  sources: SelectionActivitySources,
  ids: number[],
): { entries: { label: string; count: number }[]; overflow: number } | null {
  // Box-select returns only owned units; buildings never show in the breakdown.
  const counts = new Map<string, number>();
  for (const id of ids) {
    const u = sources.world.getComponent<UnitComponent>(id, 'unit');
    if (u && u.owner === sources.humanPlayerId) {
      const v = computeUnitActivity(sources, id, u).verb;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  const sorted = [...counts.entries()]
    .sort(([aLabel, aCount], [bLabel, bCount]) =>
      verbPriority(aLabel) - verbPriority(bLabel) || bCount - aCount || aLabel.localeCompare(bLabel),
    )
    .map(([label, count]) => ({ label, count }));
  const cap = 5;
  return sorted.length <= cap
    ? { entries: sorted, overflow: 0 }
    : { entries: sorted.slice(0, cap), overflow: sorted.length - cap };
}
