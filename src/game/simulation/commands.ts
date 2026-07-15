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
  // Spec §6.2 automatic post-construction mining: queued at Mining Camp
  // completion for each active builder; validator refuses to preempt any
  // explicit order that landed in the same drain window.
  'unit.autoGather': { unitId: number; resourceId: number; campBuildingId: number };
  'unit.context': { unitId: number; target: Position };
  'unit.contextAtEntity': { unitId: number; targetEntityId: number };
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
