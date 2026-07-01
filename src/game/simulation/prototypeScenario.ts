import type { Position } from 'civ-engine';

import type {
  AgeType,
  BuildingType,
  PlayerResources,
  ResearchableTechnologyType,
  ResourceKind,
  UnitType,
  VisionSourceComponent,
  WanderBoundsComponent,
} from './types';
import { createDefaultMap } from './mapGeneration/defaultMap';
import type { TerrainCellSpec } from './mapGeneration/sharedTerrainHelpers';
import { dispatchScenario } from './prototypeScenario/dispatch';

export { MAP_HEIGHT, MAP_WIDTH } from './mapGeneration/constants';
export const TPS = 10;
export const DEFAULT_SEED = 'aoe2-prototype';
export const HUMAN_PLAYER_ID = 1;

// Re-export helpers so existing consumers (tests, other modules)
// continue to import from `prototypeScenario`. The canonical home for
// each helper is under `mapGeneration/`, but the public surface here
// stays stable.
export {
  createBaseTerrain,
  createTerrainCell,
  distanceSquared,
  isAccessibleShorelineCell,
  isInBounds,
  orientationFor,
  paintDisc,
  projectOffset,
  seedToNumber,
  setTerrainKind,
} from './mapGeneration/sharedTerrainHelpers';

export {
  applyForestPatch,
  applyResourcePatch,
  applyShoreFishPatches,
  applyShoreFishPatchesProcedural,
  applyStandardPlayerOpening,
  applyStandardPlayerOpeningProcedural,
  createPlayerStarts,
  placeForestCluster,
  placeResourceCluster,
} from './mapGeneration/applyStandardPlayerOpening';

export {
  createStartingScoutSpawn,
  DEFAULT_RELIC_POSITIONS,
  FOREST_PATCHES,
  FORWARD_ENEMY_HOUSE_POSITION,
  FORWARD_ENEMY_SCOUT_POSITION,
  SHORE_FISH_AMOUNT,
  STARTING_BERRIES,
  STARTING_BOARS,
  STARTING_GOLD,
  STARTING_SHEEP,
  STARTING_STONE,
  STARTING_VILLAGERS,
} from './mapGeneration/startingOffsets';

export type { Offset, TerrainCellSpec } from './mapGeneration/sharedTerrainHelpers';

export interface ScenarioSpawnSpec {
  kind:
    | BuildingType
    | UnitType
    | ResourceKind;
  x: number;
  y: number;
  owner: number | null;
  baseOwner: number | null;
  amount?: number;
  velocity?: { dx: number; dy: number };
  wanderBounds?: WanderBoundsComponent;
  vision?: VisionSourceComponent;
  requiresSafeSpawn?: boolean;
  // Slice 12 Task B: opt out of the bridge-boot fixture validator for
  // a single spawn. Used by fixtures that intentionally stack
  // otherwise-illegal entities (e.g., a unit standing inside a building
  // footprint for the tile-selection-cycle UX test). Default `false`;
  // leave unset in every gameplay fixture.
  allowOverlappingSpawn?: boolean;
  // Building-only. Starts deposited relics inside a Monastery. Lets
  // tests exercise the "destroy the Monastery, drop the relics" flow
  // without driving a full pickup-and-deposit cycle.
  startingRelicsInMonastery?: number;
  // Overrides the spawned entity's starting HP so tests can make siege
  // scenarios resolve in a handful of ticks (buildings) or pre-wound a
  // unit so the heal path fires immediately (units, FU4). Ignored when
  // unset or when the value is larger than the entity's default max HP.
  startHp?: number;
  // Farm-only (M1 Farms). Overrides the stored food a completed Farm carries
  // (default 175). Lets a fixture seed a nearly-depleted farm to exercise the
  // depletion/removal path quickly. Ignored unless `kind === 'farm'`.
  farmFood?: number;
}

export interface PlayerStartSpec {
  owner: number;
  townCenter: Position;
  civilization?: string;
  startingAge?: AgeType;
  startingResources?: PlayerResources;
  // Test-only override for the Wonder and Relic victory countdown.
  // Production uses the authoritative `WONDER_COUNTDOWN_TICKS` /
  // `RELIC_COUNTDOWN_TICKS` constants; fixtures can shrink this to a
  // handful of ticks so vitest cases resolve quickly. Applied per owner.
  wonderCountdownOverrideTicks?: number;
  relicCountdownOverrideTicks?: number;
  // Slice 10 (AI baseline). Non-human players get a per-owner
  // `AiState` seeded with this difficulty level. Defaults to
  // `'standard'` when omitted. Vitest fixtures can bump this to
  // `'hard'` to stress the gather-rate multiplier, or `'easy'` to
  // confirm the opposite side of the gap.
  difficulty?: 'easy' | 'standard' | 'hard';
  // Test-only flag: skip seeding an AiState entry for this owner so
  // the planner-style `prototypeAi` system never issues commands for
  // the player's units. Fixtures use this to spawn a "passive enemy"
  // that exercises one specific behavior (auto-aggression detection,
  // boundary checks) without the standard AI walking units around.
  disableAi?: boolean;
  // Headless AI-vs-AI: seed an AiState for this owner even if it is the human
  // slot (`owner === humanPlayerId`), so a deterministic playtest can run a
  // competitive match instead of AI-vs-inert. Set only by the playtest harness
  // via `forceAiForOwners`; the real game never sets it, so the human keeps
  // control. Ignored when `disableAi` is also set (disable wins).
  forceAi?: boolean;
  // FU1: Fixtures can pre-research technologies on bridge boot so
  // tests skip the research cadence when verifying downstream effects
  // (e.g. Chemistry-gated Bombard Cannon training). Applied after
  // `researchedTechnologies` init but BEFORE combat-state creation so
  // newly-spawned units pick up the tech bonuses. Does NOT fire the
  // `applyTechnology` side effects (age-up, unit upgrades, etc.);
  // restricted to "passive-bonus" techs that only affect createCombatState.
  startingResearchedTechnologies?: ResearchableTechnologyType[];
}

export interface PrototypeScenario {
  seed: string;
  width: number;
  height: number;
  terrain: TerrainCellSpec[][];
  starts: PlayerStartSpec[];
  spawns: ScenarioSpawnSpec[];
  // Score-timer victory (spec §4.3): if set, the match ends at this tick with
  // the highest-score player winning — so a match can never stalemate. Opt-in
  // (unset = conquest/wonder/relic only, the AoE2 default). Ticks at TPS=10.
  gameLength?: number;
}

// Scenario factory dispatcher. The seed-to-fixture mapping table lives
// in `prototypeScenario/dispatch.ts` to keep this file under 500 LOC;
// the `DEFAULT_SEED` short-circuit stays here so the procedural default
// map doesn't pay the lookup cost on every fresh game.
export function createPrototypeScenario(seed = DEFAULT_SEED): PrototypeScenario {
  if (seed === DEFAULT_SEED) {
    return createDefaultMap(seed);
  }
  return dispatchScenario(seed);
}
