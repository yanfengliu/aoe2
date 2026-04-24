// Barrel module that re-exports every Imperial-Age fixture factory from
// the per-theme sub-files. The single consumer (`fixtures/ageProgression.ts`)
// pulls these names through this file, so adding a new Imperial fixture
// means dropping it into the right sub-module and re-exporting it here.

export {
  createImperialAgeFixture,
  createImperialMissingPrereqFixture,
} from './imperial/ageUp';

export {
  createImperialUpgradesFixture,
  createImperialArbalestFixture,
  createImperialHalberdierFixture,
  createImperialStableFixture,
  createImperialBlacksmithFixture,
  createImperialSiegeFixture,
} from './imperial/upgrades';

export {
  createImperialCastleBritonsFixture,
  createImperialCastleFranksFixture,
  createImperialCastleFixture,
} from './imperial/castle';
