// Barrel module that re-exports every fixture factory. The dispatcher
// in `prototypeScenario.ts` imports each fixture from here so the seed
// -> fixture wiring is the only thing the dispatcher has to maintain.
//
// When you add a new fixture, drop it into the appropriate category
// file and add its export below.

export {
  createConquestVictoryFixture,
  createConquestDefeatFixture,
  createBlockingRulesFixture,
  createUnitSharingFixture,
  createOrdersFixture,
} from './conquest';

export {
  createMiningCampFixture,
  createFishFixture,
  createVillagerNoWoodDropoffFixture,
} from './economyBasics/gathering';

export {
  createFogMemoryCastleDestroyEdgeFixture,
  createFogMemoryCastleEdgeFixture,
  createResourceDepletionFixture,
  createMoveTargetUnblocksFixture,
  createNarrowCorridorFixture,
} from './economyBasics/fogAndMovement';

export {
  createFogMemoryFixture,
  createBuildingFootprintVisionFixture,
  createBoarAggroFixture,
  createBoarHuntFixture,
  createWolfAggroFixture,
} from './economyBasics/visionAndAggro';

export {
  createGatherUnreachableRerouteFixture,
} from './economyBasics/gatherReroute';

export {
  createDropOffUnreachableRerouteFixture,
} from './economyBasics/dropOffReroute';

export {
  createFeudalMissingPrereqFixture,
  createFeudalAgeFixture,
  createFeudalBlacksmithFixture,
  createFeudalStableFixture,
  createBlockedStableSpawnFixture,
  createIsolatedScoutSpawnFixture,
  createFeudalMarketFixture,
  createFeudalSpearmanFixture,
  createFeudalSkirmisherFixture,
  createFeudalWatchTowerFixture,
} from './ageProgression/feudal';

export {
  createCastleAgeFixture,
  createCastleTownCenterFixture,
  createCastleUpgradesFixture,
} from './ageProgression/castle';

export {
  createImperialAgeFixture,
  createImperialMissingPrereqFixture,
  createImperialUpgradesFixture,
  createImperialArbalestFixture,
  createImperialHalberdierFixture,
  createImperialStableFixture,
  createImperialCastleBritonsFixture,
  createImperialCastleFranksFixture,
  createImperialSiegeFixture,
  createImperialBlacksmithFixture,
  createImperialCastleFixture,
} from './ageProgression/imperial';

export {
  createBlacksmithProgressionFixture,
  createDoubleBlacksmithRaceFixture,
} from './ageProgression/blacksmith';

export {
  createPikemanVsKnightFixture,
  createCamelVsHussarFixture,
  createHalberdierVsCavalierFixture,
  createHalberdierVsKnightFixture,
  createCamelVsCavalryFixture,
  createSpearmanVsCamelFixture,
  createPaladinFixture,
  createHeavyCamelVsKnightFixture,
} from './combatMatchups/infantryAndCavalry';

export {
  createCavalryArcherRangedFixture,
  createSkirmisherVsCavalryArcherFixture,
} from './combatMatchups/rangedSkirmish';

export {
  createMilitiaCombatFixture,
  createMovingEnemyAttackFixture,
  createChampionVsHalberdierFixture,
  createChampionVsArmoredHalberdierFixture,
  createMilitiaLineFixture,
} from './combatMatchups/generalCombat';

export {
  createAutoAggroIdleMilitiaInVisionFixture,
  createAutoAggroIdleMilitiaOutOfVisionFixture,
  createAutoAggroArcherPursuitFixture,
  createAutoAggroPlayerMoveOverridesFixture,
  createAutoAggroVillagerAdjacentFixture,
  createAutoAggroVillagerNoPursuitFixture,
  createAutoAggroVillagerGatheringFixture,
  createAutoAggroMonkSkipFixture,
  createAutoAggroSequentialTargetsFixture,
} from './combatMatchups/autoAggression';

export {
  createSiegeWorkshopFixture,
  createTowerVsSiegePriorityFixture,
} from './siege/workshop';

export {
  createMangonelRangedFixture,
  createMangonelVsSpearmanFixture,
  createMangonelVsClusteredInfantryFixture,
  createMangonelVsBuildingSplashFixture,
  createMangonelVsKnightFixture,
  createMangonelMinRangeBlockedFixture,
  createMangonelOutsideMinRangeFixture,
  createOnagerMinRangeBlockedFixture,
} from './siege/mangonel';

export {
  createScorpionRangedFixture,
} from './siege/scorpion';

export {
  createRamVsBuildingFixture,
  createRamVsVillagerFixture,
  createPikemanVsRamFixture,
  createCamelVsRamFixture,
  createSiegeRamVsBuildingFixture,
} from './siege/ram';

export {
  createBombardCannonVsBuildingFixture,
  createTownCenterReselectFixture,
  createBombardCannonMinRangeBlockedFixture,
} from './siege/bombardCannon';

export {
  createTrebuchetPackFixture,
  createTrebuchetVsBuildingFixture,
} from './siege/trebuchet';

export {
  createMonasteryFixture,
  createMonkRelicDropCrampedFixture,
  createMonkRelicDropFixture,
  createMonkRelicFixture,
} from './monastery/relic';

export {
  createMonkHealFixture,
  createMonkHealthyFriendlyWithEnemyFixture,
  createMonkHealOverConvertFixture,
} from './monastery/heal';

export {
  createMonkConvertFixture,
  createMonkConvertHeresyFixture,
  createMonkConvertMonkFixture,
  createMonkConvertMonkAtonementFixture,
  createMonkDoubleConvertFixture,
  createMonkFlipFlopFixture,
  createMonkConvertCleanupFixture,
  createMonkConvertVisionFixture,
  createMonkFogFixture,
} from './monastery/convert';

export {
  createCastleNonBritonsFixture,
  createCastleUniqueFixture,
  createCastleAiTargetPriorityFixture,
  createCastleDefensiveFireFixture,
} from './castleDefense/towerAndCastle';

export {
  createLongbowmanRangedFixture,
  createCastleFletchingFixture,
  createCastleGarrisonFixture,
  createGarrisonHealFixture,
  createGarrisonHealHerbalFixture,
} from './castleDefense/fletching';

export {
  createFu3CastleNoArchersFixture,
  createFu3CastleThreeArchersFixture,
  createFu3CastleFiveArchersFixture,
  createFu3CastleEdgeRangeFixture,
} from './castleDefense/fu3Archers';

export {
  createFu3PalisadeWallFixture,
  createFu3StoneWallFixture,
  createFu3StoneWallBlockingFixture,
  createFu3StoneWallCombatFixture,
} from './castleDefense/fu3Walls';

export {
  createAiPlannerFixture,
  createAiMonkFixture,
  createAiMonkHealFixture,
  createAiWonderFixture,
} from './ai/plannerAndMonk';

export {
  createAiMonkRelicFixture,
  createAiScoutingResponseFixture,
  createAiDifficultyFixture,
  createAiRushFixture,
  createAiEconomyFixture,
  createAiAgeUpPriorityFixture,
  createAiVillagerReserveFixture,
  createAiMarketAgeUpFixture,
} from './ai/scoutingAndRush';

export {
  createWonderImperialFixture,
  createWonderExistingFixture,
  createWonderShortCountdownFixture,
  createWonderDestroyedFixture,
  createRelicShortCountdownFixture,
  createRelicNotAllHeldFixture,
  createWonderRelicTieFixture,
  createWonderOwnerAfterConversionFixture,
} from './wonderRelic';

export { createTwoWonderTieFixture } from './fullReview';

export {
  createTownCenterDefenseFixture,
  createVillagerSelectionFixture,
  createDoubleClickSelectionFixture,
  createMixedSelectionFixture,
  createTileSelectionCycleFixture,
} from './selection';

export {
  createSheepOwnershipFixture,
  createSheepMovementFixture,
  createSheepVisionFixture,
} from './sheep';

export {
  createScenarioValidationFixture,
} from './scenarioValidation';

export {
  createAutoMineCampFixture,
  createMultiVillagerConstructionFixture,
  createRepairFixture,
  createSingleVillagerConstructionFixture,
} from './construction';

export {
  createScoreTimerDefeatFixture,
  createScoreTimerDrawFixture,
  createScoreTimerVictoryFixture,
} from './scoreTimer';

export {
  createFarmDepletionFixture,
  createFarmOwnershipFixture,
  createFarmReseedFixture,
  createFarmUpgradeTechsFixture,
  createFarmUpgradeBuildFixture,
  createFarmUpgradeReseedFixture,
} from './farms';

export {
  createLoomBrokeFixture,
  createLoomFixture,
  createLoomResearchedFixture,
} from './loom';

export {
  createTowerUpgradeBaselineFixture,
  createTowerUpgradeGuardFixture,
  createTowerUpgradeEdgeNoKeepFixture,
  createTowerUpgradeEdgeKeepFixture,
  createTowerFletchingFixture,
} from './towerUpgrades';

export {
  createSiegeEngineersBaselineFixture,
  createSiegeEngineersResearchedFixture,
} from './siegeEngineers';

export {
  createSappersBaselineFixture,
  createSappersResearchedFixture,
} from './sappers';

export {
  createBloodlinesBaselineFixture,
  createBloodlinesResearchedFixture,
  createBloodlinesFeudalStableFixture,
} from './bloodlines';

export {
  createHusbandryBaselineFixture,
  createHusbandryResearchedFixture,
} from './husbandry';

export {
  createSquiresBaselineFixture,
  createSquiresResearchedFixture,
} from './squires';

export { createLosTechsFixture } from './losTechs';

export { createConscriptionFixture } from './conscription';
export { createGatesFixture } from './gates';

export {
  createCivShepherdBritonsFixture,
  createCivShepherdControlFixture,
} from './civShepherd';

export {
  createCivFranksKnightFixture,
  createCivFranksKnightControlFixture,
} from './civFranksKnight';

export {
  createCivMongolsScoutFixture,
  createCivMongolsScoutControlFixture,
} from './civMongolsScout';

export {
  createCivGothsInfantryFixture,
  createCivGothsInfantryControlFixture,
} from './civGothsInfantry';

export {
  createCivAztecsTrainFixture,
  createCivAztecsTrainControlFixture,
} from './civAztecsTrain';

export {
  createCivGothsCostFixture,
  createCivGothsCostControlFixture,
} from './civGothsCost';

export {
  createVillagerSpeedBaselineFixture,
  createVillagerSpeedWheelbarrowFixture,
  createVillagerSpeedBothFixture,
} from './villagerSpeed';

export {
  createMonkBlockPrintingBaselineFixture,
  createMonkBlockPrintingFixture,
  createMonkSanctityBaselineFixture,
  createMonkSanctityFixture,
  createMonkFaithBaselineFixture,
  createMonkFaithDefendedFixture,
} from './monasteryTechs';

export {
  createUnitShowcaseFixture,
} from './unitShowcase';

export {
  createBuildingShowcaseFixture,
} from './buildingShowcase';

export {
  createOcclusionShowcaseFixture,
} from './occlusionShowcase';

export {
  createTerrainShowcaseFixture,
  createTerrainWaterMotionFixture,
} from './terrainShowcase';

export {
  createFeedbackShowcaseFixture,
} from './feedbackShowcase';
export {
  createNavalCastleAgeFixture,
  createNavalFixture,
  createNavalImperialFixture,
} from './naval';
export {
  createUniversityFixture,
  createUniversityImperialFixture,
} from './university';
export {
  createHeatedShotFixture,
  createHeatedShotResearchedFixture,
} from './heatedShot';
export { createAiCastleAgeMilitaryFixture } from './aiCastleAgeMilitary';
