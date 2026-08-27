// SHIFT-QUEUED ENTITY ORDERS (spec §9.3, v0.3.141) — the entity half of the
// waypoint chain. v0.3.125/126 chained ground legs (on the move command) and
// construction sites (on the build command); this chains CONTEXT orders
// across command types: gather after gather, kill after kill, repair after
// walk. The chain lives per unit in its own serialized codec (refs are
// generation-safe), a plain order wipes it, and each entry is routed through
// the SAME context router a live right-click uses, so the queued click can do
// everything the plain click could.
//
// Completion detection: the generic watcher below fires the next order for
// any unit whose whole order stack emptied (attack target dead, move arrived,
// repair done). For VILLAGERS the load-bearing piece is the explicit-flag
// drop at every target-ended path in the economy system — with the flag down
// the same-type auto-rotate stands down, the villager idles, and this
// watcher (pinned to run before the economy system) fires the chain next
// tick; the economy system's own idle-time pops are a second line only.

import type { EntityRef } from 'civ-engine';

import type { GameWorld } from './pureHelpers';
import { currentEntityId } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  monkTasksCodec,
  queuedEntityOrdersCodec,
  unitCommandsCodec,
} from './bridgeStateSerialize';
import type { GathererComponent, UnitComponent } from '../types';

export interface QueuedEntityOrder {
  target: EntityRef;
  garrison: boolean;
  forceAttack: boolean;
}

// A click storm cannot grow an unbounded save field (the v0.3.125 rule).
export const QUEUED_ENTITY_ORDER_CAP = 8;

export interface QueuedEntityOrderOps {
  /** True while the unit is executing anything a queued order should wait on. */
  unitHasActiveOrder(unitId: number): boolean;
  /** Whether a chain is waiting on this unit. */
  hasQueuedEntityOrders(unitId: number): boolean;
  /** Append to the unit's chain (silently full at the cap). */
  appendQueuedEntityOrder(unitId: number, targetEntityId: number, garrison: boolean, forceAttack: boolean): void;
  /** A plain order replaces the whole chain, as in AoE2. */
  wipeQueuedEntityOrders(unitId: number): void;
  /** Fire the next surviving entry; false when none routes. */
  popQueuedEntityOrder(unitId: number): boolean;
}

export function createQueuedEntityOrderOps(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  getEntityRef: (id: number) => EntityRef | null;
  routeUnitContextAtEntityCommandDirect: (
    unitId: number,
    targetEntityId: number,
    allowGarrison: boolean,
    forceAttack?: boolean,
  ) => boolean;
}): QueuedEntityOrderOps {
  const { world, accessor, getEntityRef, routeUnitContextAtEntityCommandDirect } = deps;

  function unitHasActiveOrder(unitId: number): boolean {
    if (accessor.get(unitCommandsCodec).has(unitId)) return true;
    if (accessor.get(monkTasksCodec).has(unitId)) return true;
    const gatherer = world.getComponent<GathererComponent>(unitId, 'gatherer');
    return gatherer !== undefined && gatherer.task !== 'idle';
  }

  function hasQueuedEntityOrders(unitId: number): boolean {
    return (accessor.get(queuedEntityOrdersCodec).get(unitId)?.length ?? 0) > 0;
  }

  function appendQueuedEntityOrder(
    unitId: number,
    targetEntityId: number,
    garrison: boolean,
    forceAttack: boolean,
  ): void {
    const ref = getEntityRef(targetEntityId);
    if (ref === null) return;
    accessor.mutate(queuedEntityOrdersCodec, (map) => {
      const chain = map.get(unitId) ?? [];
      if (chain.length >= QUEUED_ENTITY_ORDER_CAP) return;
      chain.push({ target: ref, garrison, forceAttack });
      map.set(unitId, chain);
    });
  }

  function wipeQueuedEntityOrders(unitId: number): void {
    const map = accessor.get(queuedEntityOrdersCodec);
    if (map.delete(unitId)) accessor.markDirty(queuedEntityOrdersCodec);
  }

  function popQueuedEntityOrder(unitId: number): boolean {
    const map = accessor.get(queuedEntityOrdersCodec);
    const chain = map.get(unitId);
    if (!chain || chain.length === 0) {
      if (chain) { map.delete(unitId); accessor.markDirty(queuedEntityOrdersCodec); }
      return false;
    }
    while (chain.length > 0) {
      const next = chain.shift()!;
      accessor.markDirty(queuedEntityOrdersCodec);
      const targetId = currentEntityId(world, next.target);
      if (targetId === null) continue; // the target died before its turn
      if (routeUnitContextAtEntityCommandDirect(unitId, targetId, next.garrison, next.forceAttack)) {
        if (chain.length === 0) map.delete(unitId);
        return true;
      }
    }
    map.delete(unitId);
    accessor.markDirty(queuedEntityOrdersCodec);
    return false;
  }

  // The generic completion watcher: any unit whose whole order stack emptied
  // this tick fires its next queued entry before auto-aggression can see it
  // idle (intentions land next tick; this runs after command processing).
  // Villager gather idles are ALSO handled in-pass by the economy system —
  // this system is their fallback, and the dead-or-garrisoned cleanup.
  world.registerSystem({
    name: 'prototypeQueuedEntityOrders',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute() {
      const map = accessor.get(queuedEntityOrdersCodec);
      if (map.size === 0) return;
      for (const unitId of [...map.keys()]) {
        const unit = world.getComponent<UnitComponent>(unitId, 'unit');
        if (!unit || !world.isAlive(unitId)) {
          // Dead or garrisoned (off the map either way): the chain dies too.
          map.delete(unitId);
          accessor.markDirty(queuedEntityOrdersCodec);
          continue;
        }
        if (unitHasActiveOrder(unitId)) continue;
        popQueuedEntityOrder(unitId);
      }
    },
  });

  return {
    unitHasActiveOrder,
    hasQueuedEntityOrders,
    appendQueuedEntityOrder,
    wipeQueuedEntityOrders,
    popQueuedEntityOrder,
  };
}
