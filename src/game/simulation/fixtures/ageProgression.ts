// Barrel module that re-exports every age-progression fixture factory from
// the per-age sub-files. The single consumer (`fixtures/index.ts`) pulls
// these names through this file, so adding a new age-progression fixture
// means dropping it into the right sub-module and re-exporting it here.

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
} from './ageProgression/blacksmith';
