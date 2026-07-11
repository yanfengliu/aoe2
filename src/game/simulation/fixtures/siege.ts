// Barrel module that re-exports every siege fixture factory from the
// per-weapon sub-files. The single consumer (`fixtures/index.ts`) pulls
// these names through this file, so adding a new siege fixture means
// dropping it into the right sub-module and re-exporting it here.

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
  createSiegeWorkshopFixture,
  createTowerVsSiegePriorityFixture,
} from './siege/workshop';
