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
import { createBlackForestMap } from './mapGeneration/blackForestMap';
import { createArenaMap } from './mapGeneration/arenaMap';
import type { TerrainCellSpec } from './mapGeneration/sharedTerrainHelpers';
import {
  createAiDifficultyFixture,
  createAiEconomyFixture,
  createAiMonkFixture,
  createAiMonkHealFixture,
  createAiMonkRelicFixture,
  createAiPlannerFixture,
  createAiRushFixture,
  createAiScoutingResponseFixture,
  createAiWonderFixture,
  createBlacksmithProgressionFixture,
  createBlockedStableSpawnFixture,
  createBlockingRulesFixture,
  createBoarAggroFixture,
  createBombardCannonMinRangeBlockedFixture,
  createBombardCannonVsBuildingFixture,
  createBuildingFootprintVisionFixture,
  createCamelVsCavalryFixture,
  createCamelVsHussarFixture,
  createCamelVsRamFixture,
  createCastleAgeFixture,
  createCastleAiTargetPriorityFixture,
  createCastleDefensiveFireFixture,
  createCastleFletchingFixture,
  createCastleGarrisonFixture,
  createCastleNonBritonsFixture,
  createCastleTownCenterFixture,
  createCastleUniqueFixture,
  createCastleUpgradesFixture,
  createCavalryArcherRangedFixture,
  createChampionVsArmoredHalberdierFixture,
  createChampionVsHalberdierFixture,
  createConquestDefeatFixture,
  createConquestVictoryFixture,
  createDoubleClickSelectionFixture,
  createFeudalAgeFixture,
  createFeudalBlacksmithFixture,
  createFeudalMarketFixture,
  createFeudalMissingPrereqFixture,
  createFeudalSkirmisherFixture,
  createFeudalSpearmanFixture,
  createFeudalStableFixture,
  createFeudalWatchTowerFixture,
  createFishFixture,
  createFogMemoryFixture,
  createFu3CastleEdgeRangeFixture,
  createFu3CastleFiveArchersFixture,
  createFu3CastleNoArchersFixture,
  createFu3CastleThreeArchersFixture,
  createFu3PalisadeWallFixture,
  createFu3StoneWallBlockingFixture,
  createFu3StoneWallCombatFixture,
  createFu3StoneWallFixture,
  createHalberdierVsCavalierFixture,
  createHalberdierVsKnightFixture,
  createHeavyCamelVsKnightFixture,
  createImperialAgeFixture,
  createImperialArbalestFixture,
  createImperialBlacksmithFixture,
  createImperialCastleBritonsFixture,
  createImperialCastleFixture,
  createImperialCastleFranksFixture,
  createImperialHalberdierFixture,
  createImperialMissingPrereqFixture,
  createImperialSiegeFixture,
  createImperialStableFixture,
  createImperialUpgradesFixture,
  createIsolatedScoutSpawnFixture,
  createLongbowmanRangedFixture,
  createMangonelMinRangeBlockedFixture,
  createMangonelOutsideMinRangeFixture,
  createMangonelRangedFixture,
  createMangonelVsKnightFixture,
  createMangonelVsSpearmanFixture,
  createMilitiaCombatFixture,
  createMilitiaLineFixture,
  createMiningCampFixture,
  createMixedSelectionFixture,
  createMonasteryFixture,
  createMonkConvertCleanupFixture,
  createMonkConvertFixture,
  createMonkConvertVisionFixture,
  createMonkDoubleConvertFixture,
  createMonkFogFixture,
  createMonkHealFixture,
  createMonkHealOverConvertFixture,
  createMonkHealthyFriendlyWithEnemyFixture,
  createMonkRelicDropCrampedFixture,
  createMonkRelicDropFixture,
  createMonkRelicFixture,
  createMoveTargetUnblocksFixture,
  createMovingEnemyAttackFixture,
  createOnagerMinRangeBlockedFixture,
  createOrdersFixture,
  createPaladinFixture,
  createPikemanVsKnightFixture,
  createPikemanVsRamFixture,
  createRamVsBuildingFixture,
  createRamVsVillagerFixture,
  createRelicNotAllHeldFixture,
  createRelicShortCountdownFixture,
  createResourceDepletionFixture,
  createScenarioValidationFixture,
  createScorpionRangedFixture,
  createSheepMovementFixture,
  createSheepOwnershipFixture,
  createSheepVisionFixture,
  createSiegeRamVsBuildingFixture,
  createSiegeWorkshopFixture,
  createSkirmisherVsCavalryArcherFixture,
  createSpearmanVsCamelFixture,
  createTileSelectionCycleFixture,
  createTowerVsSiegePriorityFixture,
  createTownCenterDefenseFixture,
  createTrebuchetPackFixture,
  createTrebuchetVsBuildingFixture,
  createUnitSharingFixture,
  createVillagerSelectionFixture,
  createWolfAggroFixture,
  createWonderDestroyedFixture,
  createWonderExistingFixture,
  createWonderImperialFixture,
  createWonderOwnerAfterConversionFixture,
  createWonderRelicTieFixture,
  createWonderShortCountdownFixture,
} from './fixtures';

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
}

export function createPrototypeScenario(seed = DEFAULT_SEED): PrototypeScenario {
  if (seed === DEFAULT_SEED) {
    // The procedural default map lives in a dedicated module so the
    // starting-resource / forest / fish layout has a single source of
    // truth and the spawn-list dedupe invariant is enforced up front.
    return createDefaultMap(seed);
  }

  if (seed === 'conquest-victory-fixture') {
    return createConquestVictoryFixture(seed);
  }

  if (seed === 'conquest-defeat-fixture') {
    return createConquestDefeatFixture(seed);
  }

  if (seed === 'blocking-rules-fixture') {
    return createBlockingRulesFixture(seed);
  }

  if (seed === 'unit-sharing-fixture') {
    return createUnitSharingFixture(seed);
  }

  if (seed === 'feudal-missing-prereq-fixture') {
    return createFeudalMissingPrereqFixture(seed);
  }

  if (seed === 'feudal-age-fixture') {
    return createFeudalAgeFixture(seed);
  }

  if (seed === 'feudal-blacksmith-fixture') {
    return createFeudalBlacksmithFixture(seed);
  }

  if (seed === 'feudal-stable-fixture') {
    return createFeudalStableFixture(seed);
  }

  if (seed === 'blocked-stable-spawn-fixture') {
    return createBlockedStableSpawnFixture(seed);
  }

  if (seed === 'isolated-scout-spawn-fixture') {
    return createIsolatedScoutSpawnFixture(seed);
  }

  if (seed === 'castle-age-fixture') {
    return createCastleAgeFixture(seed);
  }

  if (seed === 'castle-town-center-fixture') {
    return createCastleTownCenterFixture(seed);
  }

  if (seed === 'castle-upgrades-fixture') {
    return createCastleUpgradesFixture(seed);
  }

  if (seed === 'imperial-upgrades-fixture') {
    return createImperialUpgradesFixture(seed);
  }

  if (seed === 'imperial-age-fixture') {
    return createImperialAgeFixture(seed);
  }

  if (seed === 'imperial-missing-prereq-fixture') {
    return createImperialMissingPrereqFixture(seed);
  }

  if (seed === 'imperial-arbalest-fixture') {
    return createImperialArbalestFixture(seed);
  }

  if (seed === 'imperial-halberdier-fixture') {
    return createImperialHalberdierFixture(seed);
  }

  if (seed === 'pikeman-vs-knight-fixture') {
    return createPikemanVsKnightFixture(seed);
  }

  if (seed === 'halberdier-vs-knight-fixture') {
    return createHalberdierVsKnightFixture(seed);
  }

  if (seed === 'imperial-stable-fixture') {
    return createImperialStableFixture(seed);
  }

  if (seed === 'camel-vs-hussar-fixture') {
    return createCamelVsHussarFixture(seed);
  }

  if (seed === 'halberdier-vs-cavalier-fixture') {
    return createHalberdierVsCavalierFixture(seed);
  }

  if (seed === 'imperial-castle-britons-fixture') {
    return createImperialCastleBritonsFixture(seed);
  }

  if (seed === 'imperial-castle-franks-fixture') {
    return createImperialCastleFranksFixture(seed);
  }

  if (seed === 'camel-vs-cavalry-fixture') {
    return createCamelVsCavalryFixture(seed);
  }

  if (seed === 'spearman-vs-camel-fixture') {
    return createSpearmanVsCamelFixture(seed);
  }

  if (seed === 'cavalry-archer-ranged-fixture') {
    return createCavalryArcherRangedFixture(seed);
  }

  if (seed === 'skirmisher-vs-cavalry-archer-fixture') {
    return createSkirmisherVsCavalryArcherFixture(seed);
  }

  if (seed === 'siege-workshop-fixture') {
    return createSiegeWorkshopFixture(seed);
  }

  if (seed === 'imperial-siege-fixture') {
    return createImperialSiegeFixture(seed);
  }

  if (seed === 'imperial-blacksmith-fixture') {
    return createImperialBlacksmithFixture(seed);
  }

  if (seed === 'blacksmith-progression-fixture') {
    return createBlacksmithProgressionFixture(seed);
  }

  if (seed === 'champion-vs-halberdier-fixture') {
    return createChampionVsHalberdierFixture(seed);
  }

  if (seed === 'champion-vs-armored-halberdier-fixture') {
    return createChampionVsArmoredHalberdierFixture(seed);
  }

  if (seed === 'militia-line-fixture') {
    return createMilitiaLineFixture(seed);
  }

  if (seed === 'paladin-fixture') {
    return createPaladinFixture(seed);
  }

  if (seed === 'heavy-camel-vs-knight-fixture') {
    return createHeavyCamelVsKnightFixture(seed);
  }

  if (seed === 'fu3-castle-no-archers-fixture') {
    return createFu3CastleNoArchersFixture(seed);
  }

  if (seed === 'fu3-castle-three-archers-fixture') {
    return createFu3CastleThreeArchersFixture(seed);
  }

  if (seed === 'fu3-castle-five-archers-fixture') {
    return createFu3CastleFiveArchersFixture(seed);
  }

  if (seed === 'fu3-castle-edge-range-fixture') {
    return createFu3CastleEdgeRangeFixture(seed);
  }

  if (seed === 'fu3-stone-wall-fixture') {
    return createFu3StoneWallFixture(seed);
  }

  if (seed === 'fu3-stone-wall-blocking-fixture') {
    return createFu3StoneWallBlockingFixture(seed);
  }

  if (seed === 'fu3-stone-wall-combat-fixture') {
    return createFu3StoneWallCombatFixture(seed);
  }

  if (seed === 'fu3-palisade-wall-fixture') {
    return createFu3PalisadeWallFixture(seed);
  }

  if (seed === 'onager-min-range-blocked-fixture') {
    return createOnagerMinRangeBlockedFixture(seed);
  }

  if (seed === 'siege-ram-vs-building-fixture') {
    return createSiegeRamVsBuildingFixture(seed);
  }

  if (seed === 'bombard-cannon-vs-building-fixture') {
    return createBombardCannonVsBuildingFixture(seed);
  }

  if (seed === 'bombard-cannon-min-range-blocked-fixture') {
    return createBombardCannonMinRangeBlockedFixture(seed);
  }

  if (seed === 'imperial-castle-fixture') {
    return createImperialCastleFixture(seed);
  }

  if (seed === 'trebuchet-pack-fixture') {
    return createTrebuchetPackFixture(seed);
  }

  if (seed === 'trebuchet-vs-building-fixture') {
    return createTrebuchetVsBuildingFixture(seed);
  }

  if (seed === 'mangonel-ranged-fixture') {
    return createMangonelRangedFixture(seed);
  }

  if (seed === 'scorpion-ranged-fixture') {
    return createScorpionRangedFixture(seed);
  }

  if (seed === 'tower-vs-siege-priority-fixture') {
    return createTowerVsSiegePriorityFixture(seed);
  }

  if (seed === 'mangonel-vs-spearman-fixture') {
    return createMangonelVsSpearmanFixture(seed);
  }

  if (seed === 'mangonel-vs-knight-fixture') {
    return createMangonelVsKnightFixture(seed);
  }

  if (seed === 'mangonel-min-range-blocked-fixture') {
    return createMangonelMinRangeBlockedFixture(seed);
  }

  if (seed === 'mangonel-outside-min-range-fixture') {
    return createMangonelOutsideMinRangeFixture(seed);
  }

  if (seed === 'ram-vs-building-fixture') {
    return createRamVsBuildingFixture(seed);
  }

  if (seed === 'ram-vs-villager-fixture') {
    return createRamVsVillagerFixture(seed);
  }

  if (seed === 'pikeman-vs-ram-fixture') {
    return createPikemanVsRamFixture(seed);
  }

  if (seed === 'camel-vs-ram-fixture') {
    return createCamelVsRamFixture(seed);
  }

  if (seed === 'monastery-fixture') {
    return createMonasteryFixture(seed);
  }

  if (seed === 'monk-heal-fixture') {
    return createMonkHealFixture(seed);
  }

  if (seed === 'monk-convert-fixture') {
    return createMonkConvertFixture(seed);
  }

  if (seed === 'monk-fog-fixture') {
    return createMonkFogFixture(seed);
  }

  if (seed === 'monk-convert-vision-fixture') {
    return createMonkConvertVisionFixture(seed);
  }

  if (seed === 'monk-heal-over-convert-fixture') {
    return createMonkHealOverConvertFixture(seed);
  }

  if (seed === 'monk-healthy-friendly-with-enemy-fixture') {
    return createMonkHealthyFriendlyWithEnemyFixture(seed);
  }

  if (seed === 'monk-double-convert-fixture') {
    return createMonkDoubleConvertFixture(seed);
  }

  if (seed === 'monk-convert-cleanup-fixture') {
    return createMonkConvertCleanupFixture(seed);
  }

  if (seed === 'monk-relic-drop-fixture') {
    return createMonkRelicDropFixture(seed);
  }

  if (seed === 'monk-relic-drop-cramped-fixture') {
    return createMonkRelicDropCrampedFixture(seed);
  }

  if (seed === 'castle-unique-fixture') {
    return createCastleUniqueFixture(seed);
  }
  if (seed === 'castle-non-britons-fixture') {
    return createCastleNonBritonsFixture(seed);
  }
  if (seed === 'castle-defensive-fire-fixture') {
    return createCastleDefensiveFireFixture(seed);
  }
  if (seed === 'castle-ai-target-priority-fixture') {
    return createCastleAiTargetPriorityFixture(seed);
  }
  if (seed === 'longbowman-ranged-fixture') {
    return createLongbowmanRangedFixture(seed);
  }
  if (seed === 'castle-fletching-fixture') {
    return createCastleFletchingFixture(seed);
  }
  if (seed === 'castle-garrison-fixture') {
    return createCastleGarrisonFixture(seed);
  }
  if (seed === 'monk-relic-fixture') {
    return createMonkRelicFixture(seed);
  }

  if (seed === 'wonder-imperial-fixture') {
    return createWonderImperialFixture(seed);
  }

  if (seed === 'wonder-existing-fixture') {
    return createWonderExistingFixture(seed);
  }

  if (seed === 'wonder-short-countdown-fixture') {
    return createWonderShortCountdownFixture(seed);
  }

  if (seed === 'wonder-destroyed-fixture') {
    return createWonderDestroyedFixture(seed);
  }

  if (seed === 'relic-short-countdown-fixture') {
    return createRelicShortCountdownFixture(seed);
  }

  if (seed === 'relic-not-all-held-fixture') {
    return createRelicNotAllHeldFixture(seed);
  }

  if (seed === 'wonder-relic-tie-fixture') {
    return createWonderRelicTieFixture(seed);
  }

  if (seed === 'wonder-owner-after-conversion-fixture') {
    return createWonderOwnerAfterConversionFixture(seed);
  }

  if (seed === 'feudal-spearman-fixture') {
    return createFeudalSpearmanFixture(seed);
  }

  if (seed === 'feudal-skirmisher-fixture') {
    return createFeudalSkirmisherFixture(seed);
  }

  if (seed === 'militia-combat-fixture') {
    return createMilitiaCombatFixture(seed);
  }

  if (seed === 'moving-enemy-attack-fixture') {
    return createMovingEnemyAttackFixture(seed);
  }

  if (seed === 'feudal-watch-tower-fixture') {
    return createFeudalWatchTowerFixture(seed);
  }

  if (seed === 'ai-rush-fixture') {
    return createAiRushFixture(seed);
  }

  if (seed === 'ai-planner-fixture') {
    return createAiPlannerFixture(seed);
  }

  if (seed === 'ai-scouting-response-fixture') {
    return createAiScoutingResponseFixture(seed);
  }

  if (seed === 'ai-difficulty-fixture') {
    return createAiDifficultyFixture(seed);
  }

  if (seed === 'ai-monk-fixture') {
    return createAiMonkFixture(seed);
  }

  if (seed === 'ai-monk-heal-fixture') {
    return createAiMonkHealFixture(seed);
  }

  if (seed === 'ai-monk-relic-fixture') {
    return createAiMonkRelicFixture(seed);
  }

  if (seed === 'ai-wonder-fixture') {
    return createAiWonderFixture(seed);
  }

  if (seed === 'feudal-market-fixture') {
    return createFeudalMarketFixture(seed);
  }

  if (seed === 'town-center-defense-fixture') {
    return createTownCenterDefenseFixture(seed);
  }

  if (seed === 'mining-camp-fixture') {
    return createMiningCampFixture(seed);
  }

  if (seed === 'fish-fixture') {
    return createFishFixture(seed);
  }

  if (seed === 'boar-aggro-fixture') {
    return createBoarAggroFixture(seed);
  }

  if (seed === 'wolf-aggro-fixture') {
    return createWolfAggroFixture(seed);
  }

  if (seed === 'orders-fixture') {
    return createOrdersFixture(seed);
  }

  if (seed === 'ai-economy-fixture') {
    return createAiEconomyFixture(seed);
  }

  if (seed === 'villager-selection-fixture') {
    return createVillagerSelectionFixture(seed);
  }

  if (seed === 'double-click-selection-fixture') {
    return createDoubleClickSelectionFixture(seed);
  }

  if (seed === 'mixed-selection-fixture') {
    return createMixedSelectionFixture(seed);
  }

  if (seed === 'tile-selection-cycle-fixture') {
    return createTileSelectionCycleFixture(seed);
  }

  if (seed === 'sheep-ownership-fixture') {
    return createSheepOwnershipFixture(seed);
  }

  if (seed === 'sheep-movement-fixture') {
    return createSheepMovementFixture(seed);
  }

  if (seed === 'sheep-vision-fixture') {
    return createSheepVisionFixture(seed);
  }

  if (seed === 'resource-depletion-fixture') {
    return createResourceDepletionFixture(seed);
  }

  if (seed === 'move-target-unblocks-fixture') {
    return createMoveTargetUnblocksFixture(seed);
  }

  if (seed === 'fog-memory-fixture') {
    return createFogMemoryFixture(seed);
  }

  if (seed === 'building-footprint-vision-fixture') {
    return createBuildingFootprintVisionFixture(seed);
  }

  // Slice 11: alternate playable maps. Both share the default
  // two-player layout (same starts, same resource patches near each
  // base) so existing code paths work identically; only terrain differs.
  if (seed === 'black-forest-fixture' || seed === 'black-forest') {
    return createBlackForestMap(seed);
  }

  if (seed === 'arena-fixture' || seed === 'arena') {
    return createArenaMap(seed);
  }

  // Slice 12 Task B: scenario-validation fixtures. Each seed here is a
  // minimal scenario designed to exercise one failure mode of the new
  // bridge-boot validation pass. The `-ok-fixture` seed is the positive
  // control (no overlaps, no out-of-bounds, no wedged units).
  if (
    seed === 'slice12-validation-ok-fixture'
    || seed === 'slice12-validation-out-of-bounds-fixture'
    || seed === 'slice12-validation-overlap-fixture'
    || seed === 'slice12-validation-unit-in-building-fixture'
    || seed === 'slice12-validation-resource-on-building-fixture'
    || seed === 'slice12-validation-resource-on-resource-fixture'
  ) {
    return createScenarioValidationFixture(seed);
  }

  // Unknown seed. The top-level `DEFAULT_SEED` branch above already
  // short-circuits the default map via `createDefaultMap`, so the only
  // way to reach here is with a seed that doesn't match any fixture.
  // Fall back to the default procedural map so every caller gets a
  // valid scenario instead of undefined.
  return createDefaultMap(seed);
}
