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
  createFogMemoryCastleDestroyEdgeFixture,
  createFogMemoryCastleEdgeFixture,
  createResourceDepletionFixture,
  createMoveTargetUnblocksFixture,
  createNarrowCorridorFixture,
  createFogMemoryFixture,
  createBuildingFootprintVisionFixture,
  createBoarAggroFixture,
  createWolfAggroFixture,
  createGatherUnreachableRerouteFixture,
  createDropOffUnreachableRerouteFixture,
} from './economyBasics';

export {
  createFeudalMissingPrereqFixture,
  createFeudalAgeFixture,
  createFeudalBlacksmithFixture,
  createFeudalStableFixture,
  createBlockedStableSpawnFixture,
  createIsolatedScoutSpawnFixture,
  createCastleAgeFixture,
  createCastleTownCenterFixture,
  createCastleUpgradesFixture,
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
  createBlacksmithProgressionFixture,
  createDoubleBlacksmithRaceFixture,
  createImperialCastleFixture,
  createFeudalMarketFixture,
  createFeudalSpearmanFixture,
  createFeudalSkirmisherFixture,
  createFeudalWatchTowerFixture,
} from './ageProgression';

export {
  createPikemanVsKnightFixture,
  createCamelVsHussarFixture,
  createHalberdierVsCavalierFixture,
  createHalberdierVsKnightFixture,
  createCamelVsCavalryFixture,
  createSpearmanVsCamelFixture,
  createCavalryArcherRangedFixture,
  createSkirmisherVsCavalryArcherFixture,
  createMilitiaCombatFixture,
  createMovingEnemyAttackFixture,
  createChampionVsHalberdierFixture,
  createChampionVsArmoredHalberdierFixture,
  createMilitiaLineFixture,
  createPaladinFixture,
  createHeavyCamelVsKnightFixture,
  createAutoAggroIdleMilitiaInVisionFixture,
  createAutoAggroIdleMilitiaOutOfVisionFixture,
  createAutoAggroArcherPursuitFixture,
  createAutoAggroPlayerMoveOverridesFixture,
  createAutoAggroVillagerAdjacentFixture,
  createAutoAggroVillagerNoPursuitFixture,
  createAutoAggroVillagerGatheringFixture,
  createAutoAggroMonkSkipFixture,
  createAutoAggroSequentialTargetsFixture,
} from './combatMatchups';

export {
  createSiegeWorkshopFixture,
  createMangonelRangedFixture,
  createMangonelVsSpearmanFixture,
  createMangonelVsClusteredInfantryFixture,
  createMangonelVsBuildingSplashFixture,
  createMangonelVsKnightFixture,
  createMangonelMinRangeBlockedFixture,
  createMangonelOutsideMinRangeFixture,
  createTowerVsSiegePriorityFixture,
  createScorpionRangedFixture,
  createRamVsBuildingFixture,
  createRamVsVillagerFixture,
  createPikemanVsRamFixture,
  createCamelVsRamFixture,
  createOnagerMinRangeBlockedFixture,
  createBombardCannonVsBuildingFixture,
  createBombardCannonMinRangeBlockedFixture,
  createSiegeRamVsBuildingFixture,
  createTrebuchetPackFixture,
  createTrebuchetVsBuildingFixture,
} from './siege';

export {
  createMonasteryFixture,
  createMonkHealFixture,
  createMonkConvertFixture,
  createMonkConvertHeresyFixture,
  createMonkDoubleConvertFixture,
  createMonkFlipFlopFixture,
  createMonkConvertCleanupFixture,
  createMonkRelicDropCrampedFixture,
  createMonkRelicDropFixture,
  createMonkHealthyFriendlyWithEnemyFixture,
  createMonkHealOverConvertFixture,
  createMonkConvertVisionFixture,
  createMonkFogFixture,
  createMonkRelicFixture,
} from './monastery';

export {
  createCastleNonBritonsFixture,
  createCastleUniqueFixture,
  createCastleAiTargetPriorityFixture,
  createCastleDefensiveFireFixture,
  createLongbowmanRangedFixture,
  createCastleFletchingFixture,
  createCastleGarrisonFixture,
  createGarrisonHealFixture,
  createGarrisonHealHerbalFixture,
  createFu3CastleNoArchersFixture,
  createFu3CastleThreeArchersFixture,
  createFu3CastleFiveArchersFixture,
  createFu3CastleEdgeRangeFixture,
  createFu3PalisadeWallFixture,
  createFu3StoneWallFixture,
  createFu3StoneWallBlockingFixture,
  createFu3StoneWallCombatFixture,
} from './castleDefense';

export {
  createAiPlannerFixture,
  createAiMonkFixture,
  createAiMonkHealFixture,
  createAiWonderFixture,
  createAiMonkRelicFixture,
  createAiScoutingResponseFixture,
  createAiDifficultyFixture,
  createAiRushFixture,
  createAiEconomyFixture,
  createAiAgeUpPriorityFixture,
} from './ai';

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
  createTerrainShowcaseFixture,
} from './terrainShowcase';

export {
  createFeedbackShowcaseFixture,
} from './feedbackShowcase';
