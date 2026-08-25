// Shared bridge-side types consumed by both the facade `createSimulationBridge`
// and the helper-ops modules under `bridge/`. Lives here so the helper modules
// don't have to circularly import their orchestrator just for a type.
//
// V4-19 follow-up to the Phase-5 split: the orchestrator was carrying type
// definitions that 6+ child modules import from it.

import type { EntityRef, Position } from 'civ-engine';

export interface UnitCommand {
  // 'build' constructs an in-progress building; 'repair' restores a COMPLETE
  // damaged one (spec §8.1). They are distinct so a stale builder command left
  // over after a building completes clears instead of becoming a free repair.
  // 'attack-move' walks to `target` like 'move', but engages anything met on
  // the way REGARDLESS of the unit's stance, then resumes. It is the order
  // that says "go there and fight what you find" (spec §12.4.2).
  // 'garrison' walks to a friendly building and goes IN on arrival, which is
  // what AoE2 does; garrisoning used to happen on the spot from any distance,
  // so a villager six cells from its Town Center escaped anything chasing it
  // the instant the order was given.
  // 'trade' walks a Trade Cart to another player's Market and back to its own,
  // forever: `buildingRef` is the CURRENT leg's destination, `tradeFarMarketRef`
  // the route's far end, and `tradeCarriedGold` is present only on the return
  // leg — the goods were loaded at the far Market, so the deposit pays even if
  // that Market has since burned down (AoE2's own behaviour).
  type: 'move' | 'attack-move' | 'attack-ground' | 'build' | 'attack' | 'repair' | 'garrison' | 'trade';
  target: Position;
  // Shift-queued waypoints (v0.3.125): legs still to walk after `target`.
  queuedTargets?: Position[];
  buildingRef?: EntityRef;
  targetEntityRef?: EntityRef;
  targetEntityKind?: 'unit' | 'building' | 'resource';
  tradeFarMarketRef?: EntityRef;
  tradeCarriedGold?: number;
}

// Slice 5 Monk task. A Monk can heal a friendly wounded unit, convert an
// enemy unit, pick up a neutral relic, or deposit a carried relic in a
// friendly Monastery. The task encodes the target by stable EntityRef so
// cleanup is automatic when the target is destroyed.
export interface MonkTask {
  kind: 'heal' | 'convert' | 'pickup' | 'deposit';
  targetEntityRef: EntityRef;
}

export interface ConstructionState {
  isComplete: boolean;
  buildProgressTicks: number;
  totalBuildTicks: number;
  populationProvided: number;
  width: number;
  height: number;
}

// FU7: Trebuchet pack/unpack state. Each Trebuchet has a `packed` flag
// (mobile when true, stationary-fire when false) and a
// `transitionTicksRemaining` counter that is > 0 while a pack <-> unpack
// transition is in progress.
export interface TrebuchetPackState {
  packed: boolean;
  transitionTicksRemaining: number;
}
