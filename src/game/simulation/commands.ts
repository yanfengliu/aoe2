// civ-engine GameCommands surface for aoe2.
//
// Per DESIGN.md v17 §6.1 (+ spec §6.2 auto-mine): 16 command types covering every gameplay-state
// mutating bridge method. Selection / placement-preview / save-load are
// NOT commands (UI state, no replay relevance).
//
// Each command has a paired validator (returns true|false|Rejection per
// `CommandValidationResult` in civ-engine) and a paired handler (pure
// mutation; for resource-dependent commands also does an execution-time
// re-check for the batched-same-frame case — see §6.2 B2 fix).

import type { Position } from 'civ-engine';
import type { UnitStance } from './unitStance';

import type {
  BuildableBuildingType,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
  ActionType,
} from './types';

// Building-scoped actions. Today this is just `'ungarrison'`. Extensible.
// Renamed from `ActionType` per DESIGN v15 NIT — `ActionType` is currently a
// type alias in types.ts; v0.1.6 keeps the alias for back-compat and adds
// `BuildingActionType` as the canonical name used by the command surface.
export type BuildingActionType = ActionType;
export type MonkContextTaskKind = 'heal' | 'convert' | 'pickup' | 'deposit';

export type GameCommands = {
  // --- Unit orders (issued by human input directly OR by AI dispatcher post-step) ---
  'unit.move': { unitId: number; target: Position };
  'unit.attack': {
    unitId: number;
    targetEntityId: number;
    // Kind tag preserved from the bridge facade so the handler routes
    // ownership/wildlife checks correctly (mirrors the pre-Phase-1B
    // `issueUnitAttackCommand` signature).
    targetEntityKind: 'unit' | 'building' | 'resource';
  };
  'unit.gather': { unitId: number; resourceId: number };
  // M6 control: the player sets a unit's stance. It rides the recorded command
  // channel because it changes what the unit does on later ticks, so a replay
  // that skipped it would diverge.
  'unit.stance': { unitIds: number[]; stance: UnitStance };
  // M6 control: "go here and fight what you meet". Same shape as unit.move.
  'unit.attackMove': { unitId: number; target: Position };
  // Spec §6.2 automatic post-construction mining: queued at Mining Camp
  // completion for each active builder; validator refuses to preempt any
  // explicit order that landed in the same drain window.
  'unit.autoGather': { unitId: number; resourceId: number; campBuildingId: number };
  // `garrison` carries the player's EXPLICIT garrison intent (Alt+right-click,
  // spec §9.3). It rides the recorded command because it is part of the order,
  // not a UI detail: without it a recorded garrison would replay as a move.
  // ABSENT means a recording made before the rule changed, when a plain
  // right-click garrisoned — replaying those must preserve what the player saw,
  // so the handler treats absence as garrison-allowed. Live paths always set it.
  'unit.context': { unitId: number; target: Position; garrison?: boolean };
  'unit.contextAtEntity': { unitId: number; targetEntityId: number; garrison?: boolean };
  // --- Specialty unit orders ---
  'sheep.move': { sheepId: number; target: Position };
  'monk.contextAtEntity': {
    unitId: number;
    targetEntityId: number;
    expectedOwner?: number;
    intendedTaskKind?: MonkContextTaskKind;
  };
  'trebuchet.pack': { unitId: number };
  'trebuchet.unpack': { unitId: number };
  // --- Production / research / economy ---
  'queue.train': { buildingId: number; unitType: TrainableUnitType };
  'queue.research': { buildingId: number; technologyType: ResearchableTechnologyType };
  'market.action': { playerId: number; actionType: MarketActionType };
  // --- Construction + building actions ---
  'building.placeConfirm': { builderId: number; buildingType: BuildableBuildingType; position: Position; additionalBuilderIds?: number[] };
  'building.setRallyPoint': { buildingId: number; target: Position };
  'building.action': { buildingId: number; actionType: BuildingActionType };
};
